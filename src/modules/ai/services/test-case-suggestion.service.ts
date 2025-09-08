import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../../projects/project.entity';
import { Endpoint } from '../../endpoints/endpoint.entity';
import { AISuggestion } from '../entities/ai-suggestion.entity';
import { AssistantManagerService } from './assistant-manager.service';
import { ThreadManagerService } from './thread-manager.service';
import { OpenAIConfigService } from './openai-config.service';
import { TestCaseSuggestionRequestDto, TestCaseSuggestionDto } from '../dto/test-case-suggestion.dto';

/**
 * Test Case Suggestion Service
 * 
 * Handles AI-powered test case suggestions using OpenAI's Assistant API.
 * Generates intelligent suggestions for test cases based on existing code
 * and user requirements, helping identify gaps in test coverage.
 * 
 * @service TestCaseSuggestionService
 */
@Injectable()
export class TestCaseSuggestionService {
  private readonly logger = new Logger(TestCaseSuggestionService.name);
  private openai: OpenAI | null = null;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Endpoint)
    private readonly endpointRepository: Repository<Endpoint>,
    @InjectRepository(AISuggestion)
    private readonly aiSuggestionRepository: Repository<AISuggestion>,
    private readonly assistantManagerService: AssistantManagerService,
    private readonly threadManagerService: ThreadManagerService,
    private readonly openAIConfigService: OpenAIConfigService,
  ) {}

  /**
   * Configures the OpenAI API key dynamically.
   * 
   * @private
   * @throws Error - If API key is not configured
   */
  private async configureOpenAI() {
    const apiKey = await this.openAIConfigService.getOpenAIKey();
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Configure the API key in Settings > OpenAI Configuration.');
    }
    
    // Create OpenAI instance if it doesn't exist
    if (!this.openai) {
      this.openai = new OpenAI({ apiKey });
    } else {
      // Update existing instance with new API key
      this.openai.apiKey = apiKey;
    }
  }

  /**
   * Generates test case suggestions using AI.
   * 
   * @param projectId - The project ID
   * @param request - The suggestion request parameters
   * @returns Promise<TestCaseSuggestionDto[]> - Array of generated suggestions
   * @throws Error - If generation fails
   * 
   * @example
   * ```typescript
   * const suggestions = await testCaseSuggestionService.generateSuggestions('project-123', {
   *   entityName: 'Product',
   *   section: 'ecommerce',
   *   requirements: 'Generate test cases for product validation'
   * });
   * ```
   */
  async generateSuggestions(
    projectId: string, 
    request: TestCaseSuggestionRequestDto
  ): Promise<TestCaseSuggestionDto[]> {
    const startTime = Date.now();
    const suggestionId = `AI-SUGGEST-${Date.now()}`;
    
    this.logger.log(`🚀 [${suggestionId}] STARTING TEST CASE SUGGESTIONS GENERATION`);
    this.logger.log(`📋 [${suggestionId}] Request: ${JSON.stringify(request, null, 2)}`);
    
    try {
      // Configure OpenAI before making the call
      await this.configureOpenAI();
      
      // Get the project to use its path
      const project = await this.projectRepository.findOneBy({ id: projectId });
      if (!project) {
        throw new Error(`Project with ID ${projectId} not found`);
      }
      
      this.logger.log(`📁 [${suggestionId}] Project found: ${project.name} (${project.path})`);
      
      // Create debug directory in playwright-workspaces root
      // const debugDir = path.join(path.dirname(project.path), 'debug');
      // if (!fs.existsSync(debugDir)) {
      //   fs.mkdirSync(debugDir, { recursive: true });
      // }

      // Step 1: Get existing Assistant
      this.logger.log(`🤖 [${suggestionId}] STEP 1: Getting existing Assistant...`);
      const assistant = await this.assistantManagerService.getAssistant(projectId);
      if (!assistant) {
        this.logger.error(`❌ [${suggestionId}] ERROR: No assistant created for project ${projectId}. You must initialize the AI context first.`);
        throw new Error(`No assistant created for the project. Initialize the AI context with endpoint /ai/projects/:projectId/assistant/init before generating suggestions.`);
      }
      this.logger.log(`✅ [${suggestionId}] Assistant ready: ${assistant.assistantId}`);

      // Step 2: Create NEW Thread to avoid history
      this.logger.log(`🧵 [${suggestionId}] STEP 2: Creating NEW Thread...`);
      let thread = await this.threadManagerService.createThread(projectId, assistant.assistantId);
      this.logger.log(`✅ [${suggestionId}] NEW Thread created: ${thread.threadId}`);

      // Step 3: Build prompt for suggestions
      this.logger.log(`📝 [${suggestionId}] STEP 3: Building prompt for suggestions...`);
      const { prompt, featureContent, stepsContent } = await this.buildSuggestionPrompt(projectId, request);
      this.logger.log(`📤 [${suggestionId}] Prompt built (${prompt.length} characters)`);
      
      // Save sent prompt
      // const promptPath = path.join(debugDir, 'ai-suggestion-prompt.txt');
      // fs.writeFileSync(promptPath, prompt);
      // this.logger.log(`📄 [${suggestionId}] Prompt saved to: ${promptPath}`);

      // Step 4: Send message to assistant
      this.logger.log(`💬 [${suggestionId}] STEP 4: Sending message to assistant...`);
      if (!this.openai) {
        throw new Error('OpenAI client not configured');
      }
      const message = await this.openai.beta.threads.messages.create(thread.threadId, {
        role: 'user',
        content: prompt
      });
      this.logger.log(`✅ [${suggestionId}] Message sent: ${message.id}`);

      // Step 5: Execute run
      this.logger.log(`▶️ [${suggestionId}] STEP 5: Executing run...`);
      if (!this.openai) {
        throw new Error('OpenAI client not configured');
      }
      const run = await this.openai.beta.threads.runs.create(thread.threadId, {
        assistant_id: assistant.assistantId,
        tool_choice: 'auto',
        truncation_strategy: { type: 'auto' },
      });
      this.logger.log(`✅ [${suggestionId}] Run started: ${run.id} (status: ${run.status})`);

      // Step 6: Wait for run completion
      this.logger.log(`⏳ [${suggestionId}] STEP 6: Waiting for run completion...`);
      const result = await this.waitForRunCompletion(thread.threadId, run.id, suggestionId);
      this.logger.log(`✅ [${suggestionId}] Run completed: ${result.status}`);

      // Step 7: Get response
      this.logger.log(`📥 [${suggestionId}] STEP 7: Getting response...`);
      if (!this.openai) {
        throw new Error('OpenAI client not configured');
      }
      const messages = await this.openai.beta.threads.messages.list(thread.threadId);
      const lastMessage = messages.data[0]; // The most recent
      
      if (!lastMessage || !lastMessage.content || lastMessage.content.length === 0) {
        throw new Error('No response received from assistant');
      }

      const generatedText = lastMessage.content[0].type === 'text' 
        ? lastMessage.content[0].text.value 
        : 'Could not extract text from response';

      this.logger.log(`📥 [${suggestionId}] Response received (${generatedText.length} characters)`);
      
      // Save raw response
      // const responsePath = path.join(debugDir, 'ai-suggestion-response.txt');
      // fs.writeFileSync(responsePath, generatedText);
      // this.logger.log(`📄 [${suggestionId}] Response saved to: ${responsePath}`);

      // Step 8: Increment message counter
      await this.threadManagerService.incrementMessageCount(thread.threadId);
      this.logger.log(`📊 [${suggestionId}] Message counter incremented`);

      // Step 9: Parse response to extract suggestions
      this.logger.log(`🔍 [${suggestionId}] STEP 9: Parsing suggestions...`);
      const suggestions = this.parseSuggestions(generatedText);
      this.logger.log(`✅ [${suggestionId}] Suggestions parsed: ${suggestions.length} found`);

      const processingTime = Date.now() - startTime;
      this.logger.log(`🎉 [${suggestionId}] SUGGESTIONS GENERATION COMPLETED in ${processingTime}ms`);

      // Step 10: Save suggestions to database
      this.logger.log(`💾 [${suggestionId}] STEP 10: Saving suggestions to database...`);
      const aiSuggestion = new AISuggestion();
      aiSuggestion.suggestionId = suggestionId;
      aiSuggestion.projectId = projectId;
      aiSuggestion.entityName = request.entityName;
      aiSuggestion.section = request.section;
      aiSuggestion.requirements = request.requirements;
      aiSuggestion.suggestions = suggestions;
      aiSuggestion.totalSuggestions = suggestions.length;
      aiSuggestion.assistantId = assistant.assistantId;
      aiSuggestion.threadId = thread.threadId;
      aiSuggestion.runId = run.id;
      aiSuggestion.processingTime = processingTime;
      aiSuggestion.status = 'completed';
      aiSuggestion.metadata = {
        featureContentLength: featureContent.length,
        stepsContentLength: stepsContent.length,
        promptLength: prompt.length,
        responseLength: generatedText.length,
      };

      const savedSuggestion = await this.aiSuggestionRepository.save(aiSuggestion);
      this.logger.log(`✅ [${suggestionId}] Suggestions saved to database with ID: ${savedSuggestion.id}`);

      // Save final summary
      const summary = {
        suggestionId,
        request,
        assistantId: assistant.assistantId,
        threadId: thread.threadId,
        runId: run.id,
        suggestions,
        processingTime,
        success: true,
        timestamp: new Date().toISOString(),
        dbId: savedSuggestion.id,
      };
      
      // const summaryPath = path.join(debugDir, 'ai-suggestion-summary.json');
      // fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
      // this.logger.log(`📄 [${suggestionId}] Summary saved to: ${summaryPath}`);

      return suggestions;

    } catch (error) {
      this.logger.error(`❌ [${suggestionId}] ERROR in suggestions generation: ${error.message}`);
      this.logger.error(`❌ [${suggestionId}] Stack trace: ${error.stack}`);
      
      // Save error to database
      try {
        const aiSuggestion = new AISuggestion();
        aiSuggestion.suggestionId = suggestionId;
        aiSuggestion.projectId = projectId;
        aiSuggestion.entityName = request.entityName;
        aiSuggestion.section = request.section;
        aiSuggestion.requirements = request.requirements;
        aiSuggestion.suggestions = [];
        aiSuggestion.totalSuggestions = 0;
        aiSuggestion.status = 'failed';
        aiSuggestion.errorMessage = error.message;
        aiSuggestion.processingTime = Date.now() - startTime;
        aiSuggestion.metadata = {
          error: error.message,
          stack: error.stack,
          request,
        };

        await this.aiSuggestionRepository.save(aiSuggestion);
        this.logger.log(`💾 [${suggestionId}] Error saved to database`);
      } catch (dbError) {
        this.logger.error(`❌ [${suggestionId}] Error saving to database: ${dbError.message}`);
      }
      
      // Save error to file
      const errorLog = {
        suggestionId,
        request,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      };
      
      // Get the project to use its path
      // const project = await this.projectRepository.findOneBy({ id: projectId });
      // if (project) {
      //   const debugDir = path.join(path.dirname(project.path), 'debug');
      //   if (!fs.existsSync(debugDir)) {
      //     fs.mkdirSync(debugDir, { recursive: true });
      //   }
      //   
      //   const errorPath = path.join(debugDir, 'ai-suggestion-error.json');
      //   fs.writeFileSync(errorPath, JSON.stringify(errorLog, null, 2));
      //   this.logger.log(`📄 [${suggestionId}] Error saved to: ${errorPath}`);
      // }
      
      throw error;
    }
  }

  /**
   * Builds an optimized prompt for generating test case suggestions.
   * 
   * @private
   * @param projectId - The project ID
   * @param request - The suggestion request parameters
   * @returns Promise<{ prompt: string; featureContent: string; stepsContent: string }> - The optimized prompt and file contents
   * @throws Error - If project or endpoint not found
   */
  private async buildSuggestionPrompt(projectId: string, request: TestCaseSuggestionRequestDto): Promise<{ prompt: string; featureContent: string; stepsContent: string }> {
    // Get current files for the entity
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`);
    }

    let featureContent = '';
    let stepsContent = '';
    let featurePath = '';
    let stepsPath = '';

    // Find the endpoint to get generated files
    const endpoint = await this.endpointRepository.findOne({ 
      where: { projectId: projectId, section: request.section, entityName: request.entityName } 
    });

    if (endpoint && endpoint.generatedArtifacts) {
      // Parse generatedArtifacts if it's a JSON string
      let artifacts: any;
      try {
        artifacts = typeof endpoint.generatedArtifacts === 'string'
          ? JSON.parse(endpoint.generatedArtifacts)
          : endpoint.generatedArtifacts;
        
        this.logger.log(`📁 [SUGGESTION] GeneratedArtifacts parsed: ${JSON.stringify(artifacts, null, 2)}`);
      } catch (e) {
        this.logger.warn(`⚠️ Error parsing generatedArtifacts: ${e.message}`);
        artifacts = {};
      }

      // Read feature file if it exists
      if (artifacts.feature) {
        featurePath = path.join(project.path, artifacts.feature);
        this.logger.log(`📁 [SUGGESTION] Trying to read feature file: ${featurePath}`);
        
        if (fs.existsSync(featurePath)) {
          featureContent = fs.readFileSync(featurePath, 'utf-8');
          this.logger.log(`✅ [SUGGESTION] Feature file read successfully (${featureContent.length} characters)`);
        } else {
          this.logger.warn(`⚠️ [SUGGESTION] Feature file not found: ${featurePath}`);
        }
      }

      // Read steps file if it exists
      if (artifacts.steps) {
        stepsPath = path.join(project.path, artifacts.steps);
        this.logger.log(`📁 [SUGGESTION] Trying to read steps file: ${stepsPath}`);
        
        if (fs.existsSync(stepsPath)) {
          stepsContent = fs.readFileSync(stepsPath, 'utf-8');
          this.logger.log(`✅ [SUGGESTION] Steps file read successfully (${stepsContent.length} characters)`);
        } else {
          this.logger.warn(`⚠️ [SUGGESTION] Steps file not found: ${stepsPath}`);
        }
      }
    }

    return {
      prompt: `Generate 5 test case suggestions for "${request.entityName}" (${request.section}).

USER REQUIREMENTS: ${request.requirements}

📁 CURRENT FILES INCLUDED IN PROMPT:

=== FEATURE FILE (${featurePath || 'Does not exist'}) ===
${featureContent || 'No feature file exists for this entity'}

=== STEPS FILE (${stepsPath || 'Does not exist'}) ===
${stepsContent || 'No steps file exists for this entity'}

📋 DETAILED INSTRUCTIONS:

1. **ANALYSIS OF EXISTING FILES:**
   - Review the FEATURE FILE to see what scenarios already exist
   - Review the STEPS FILE to see what steps are already implemented
   - DO NOT suggest test cases that already exist
   - Identify coverage areas that might be missing

2. **SUGGESTION GENERATION:**
   - Generate EXACTLY 5 suggestions
   - Each suggestion must be unique and add value
   - Focus on edge cases, validations, and error scenarios
   - Consider positive and negative cases
   - Keep suggestions concise but informative

3. **STRICT RULES:**
   - REST APIs ONLY
   - DO NOT duplicate existing scenarios
   - Suggestions must be specific and actionable
   - Consider different types of testing: unit, integration, e2e
   - Focus on code coverage and edge cases

4. **MANDATORY RESPONSE FORMAT:**
   YOU MUST use exactly this format for the system to process your response:

   ***Suggestion 1:***
   **Short Prompt:** [Short and descriptive prompt]
   **Short Description:** [Brief test case description]
   **Detailed Description:** [Detailed description explaining purpose and coverage]

   ***Suggestion 2:***
   **Short Prompt:** [Short and descriptive prompt]
   **Short Description:** [Brief test case description]
   **Detailed Description:** [Detailed description explaining purpose and coverage]

   [Continue for all 5 suggestions...]

5. **SPECIFIC STRUCTURE:**
   - SHORT PROMPT: Maximum 10 words, clear and direct
   - SHORT DESCRIPTION: Maximum 20 words, explains what it validates
   - DETAILED DESCRIPTION: Maximum 100 words, explains purpose, coverage and value

Generate ONLY the 5 suggestions using the specified format. DO NOT include other comments or explanations outside the required format.`,
      featureContent,
      stepsContent
    };
  }

  /**
   * Parses the assistant response to extract suggestions.
   * 
   * @private
   * @param generatedText - The generated text from the assistant
   * @returns TestCaseSuggestionDto[] - Array of parsed suggestions
   */
  private parseSuggestions(generatedText: string): TestCaseSuggestionDto[] {
    const suggestions: TestCaseSuggestionDto[] = [];
    
    // Search for suggestion patterns in the text
    const suggestionPattern = /\*\*\*Suggestion (\d+):\*\*\*\s*\*\*Short Prompt:\*\*\s*([^\n]+)\s*\*\*Short Description:\*\*\s*([^\n]+)\s*\*\*Detailed Description:\*\*\s*([^\n]+)/g;
    
    let match;
    while ((match = suggestionPattern.exec(generatedText)) !== null) {
      const suggestion: TestCaseSuggestionDto = {
        shortPrompt: match[2].trim(),
        shortDescription: match[3].trim(),
        detailedDescription: match[4].trim()
      };
      suggestions.push(suggestion);
    }

    // If no suggestions found with the pattern, try alternative parsing
    if (suggestions.length === 0) {
      this.logger.warn('Could not parse suggestions with standard pattern, trying alternative parsing...');
      
      // More flexible alternative parsing
      const lines = generatedText.split('\n');
      let currentSuggestion: Partial<TestCaseSuggestionDto> = {};
      
      for (const line of lines) {
        if (line.includes('Short Prompt:')) {
          if (Object.keys(currentSuggestion).length === 3) {
            suggestions.push(currentSuggestion as TestCaseSuggestionDto);
            currentSuggestion = {};
          }
          currentSuggestion.shortPrompt = line.split('Short Prompt:')[1]?.trim() || '';
        } else if (line.includes('Short Description:')) {
          currentSuggestion.shortDescription = line.split('Short Description:')[1]?.trim() || '';
        } else if (line.includes('Detailed Description:')) {
          currentSuggestion.detailedDescription = line.split('Detailed Description:')[1]?.trim() || '';
        }
      }
      
      // Add the last suggestion if it's complete
      if (Object.keys(currentSuggestion).length === 3) {
        suggestions.push(currentSuggestion as TestCaseSuggestionDto);
      }
    }

    // If still no suggestions, create default suggestions based on context
    if (suggestions.length === 0) {
      this.logger.warn('Could not parse suggestions, creating default suggestions...');
      
      // Create basic suggestions based on context
      const defaultSuggestions = [
        {
          shortPrompt: 'Validate required fields',
          shortDescription: 'Test API validation for missing required fields',
          detailedDescription: 'This test case validates that the API correctly returns validation errors when required fields are missing from the request body.'
        },
        {
          shortPrompt: 'Test successful creation',
          shortDescription: 'Verify successful resource creation with valid data',
          detailedDescription: 'This test case ensures that the API successfully creates a resource when all required fields are provided with valid data.'
        },
        {
          shortPrompt: 'Test error handling',
          shortDescription: 'Validate proper error responses for invalid data',
          detailedDescription: 'This test case verifies that the API returns appropriate error messages and status codes when invalid data is submitted.'
        },
        {
          shortPrompt: 'Test edge cases',
          shortDescription: 'Validate behavior with boundary values and edge cases',
          detailedDescription: 'This test case covers edge cases such as maximum/minimum values, empty strings, and boundary conditions.'
        },
        {
          shortPrompt: 'Test data integrity',
          shortDescription: 'Verify data consistency and integrity after operations',
          detailedDescription: 'This test case ensures that data remains consistent and accurate after create, update, or delete operations.'
        }
      ];
      
      suggestions.push(...defaultSuggestions);
    }

    this.logger.log(`✅ Suggestions parsed successfully: ${suggestions.length}`);
    return suggestions;
  }

  /**
   * Gets all suggestions for a project.
   * 
   * @param projectId - The project ID
   * @returns Promise<AISuggestion[]> - Array of AI suggestions
   * 
   * @example
   * ```typescript
   * const suggestions = await testCaseSuggestionService.getProjectSuggestions('project-123');
   * ```
   */
  async getProjectSuggestions(projectId: string): Promise<AISuggestion[]> {
    return await this.aiSuggestionRepository.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Gets suggestions by entity and section.
   * 
   * @param projectId - The project ID
   * @param entityName - The entity name
   * @param section - The section name
   * @returns Promise<AISuggestion[]> - Array of AI suggestions
   * 
   * @example
   * ```typescript
   * const suggestions = await testCaseSuggestionService.getSuggestionsByEntityAndSection(
   *   'project-123', 'Product', 'ecommerce'
   * );
   * ```
   */
  async getSuggestionsByEntityAndSection(
    projectId: string, 
    entityName: string, 
    section: string
  ): Promise<AISuggestion[]> {
    return await this.aiSuggestionRepository.find({
      where: { projectId, entityName, section },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Gets a specific suggestion by ID.
   * 
   * @param suggestionId - The suggestion ID
   * @returns Promise<AISuggestion | null> - The AI suggestion or null if not found
   * 
   * @example
   * ```typescript
   * const suggestion = await testCaseSuggestionService.getSuggestionById('AI-SUGGEST-123');
   * ```
   */
  async getSuggestionById(suggestionId: string): Promise<AISuggestion | null> {
    return await this.aiSuggestionRepository.findOne({
      where: { suggestionId },
    });
  }

  /**
   * Deletes a suggestion.
   * 
   * @param suggestionId - The suggestion ID
   * @returns Promise<void>
   * 
   * @example
   * ```typescript
   * await testCaseSuggestionService.deleteSuggestion('AI-SUGGEST-123');
   * ```
   */
  async deleteSuggestion(suggestionId: string): Promise<void> {
    const suggestion = await this.aiSuggestionRepository.findOne({
      where: { suggestionId },
    });
    
    if (suggestion) {
      await this.aiSuggestionRepository.remove(suggestion);
      this.logger.log(`🗑️ Suggestion deleted: ${suggestionId}`);
    }
  }

  /**
   * Gets suggestion statistics for a project.
   * 
   * @param projectId - The project ID
   * @returns Promise<object> - Statistics object with totals and averages
   * 
   * @example
   * ```typescript
   * const stats = await testCaseSuggestionService.getSuggestionStats('project-123');
   * console.log(`Total suggestions: ${stats.total}`);
   * ```
   */
  async getSuggestionStats(projectId: string): Promise<{
    total: number;
    completed: number;
    failed: number;
    totalSuggestions: number;
    averageProcessingTime: number;
  }> {
    const suggestions = await this.aiSuggestionRepository.find({
      where: { projectId },
    });

    const total = suggestions.length;
    const completed = suggestions.filter(s => s.status === 'completed').length;
    const failed = suggestions.filter(s => s.status === 'failed').length;
    const totalSuggestions = suggestions.reduce((sum, s) => sum + s.totalSuggestions, 0);
    const averageProcessingTime = suggestions.length > 0 
      ? suggestions.reduce((sum, s) => sum + (s.processingTime || 0), 0) / suggestions.length 
      : 0;

    return {
      total,
      completed,
      failed,
      totalSuggestions,
      averageProcessingTime,
    };
  }

  /**
   * Waits for a run to complete.
   * 
   * @private
   * @param threadId - The thread ID
   * @param runId - The run ID
   * @param suggestionId - The suggestion ID for logging
   * @returns Promise<any> - The completed run object
   * @throws Error - If run fails, is cancelled, expires, or times out
   */
  private async waitForRunCompletion(threadId: string, runId: string, suggestionId: string): Promise<any> {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes maximum (60 * 5 seconds)
    
    while (attempts < maxAttempts) {
      attempts++;
      this.logger.log(`⏳ [${suggestionId}] Checking run (attempt ${attempts}/${maxAttempts})...`);
      
      if (!this.openai) {
        throw new Error('OpenAI client not configured');
      }
      const run = await this.openai.beta.threads.runs.retrieve(threadId, runId);
      
      this.logger.log(`📊 [${suggestionId}] Run status: ${run.status}`);
      
      if (run.status === 'completed') {
        this.logger.log(`✅ [${suggestionId}] Run completed successfully`);
        return run;
      }
      
      if (run.status === 'failed') {
        this.logger.error(`❌ [${suggestionId}] Run failed: ${run.last_error?.message || 'Unknown error'}`);
        throw new Error(`Run failed: ${run.last_error?.message || 'Unknown error'}`);
      }
      
      if (run.status === 'cancelled') {
        this.logger.error(`❌ [${suggestionId}] Run cancelled`);
        throw new Error('Run was cancelled');
      }
      
      if (run.status === 'expired') {
        this.logger.error(`❌ [${suggestionId}] Run expired`);
        throw new Error('Run expired');
      }
      
      // Wait 5 seconds before next attempt
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    throw new Error(`Run timeout after ${maxAttempts} attempts`);
  }
}
