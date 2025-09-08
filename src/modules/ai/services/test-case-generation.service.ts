import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { 
  AIGenerationRequest, 
  AIGenerationResponse, 
  GeneratedCode, 
  CodeInsertion,
  ProjectContext 
} from '../interfaces/ai-agent.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../../projects/project.entity';
import { Endpoint } from '../../endpoints/endpoint.entity';
import { 
  StepFilesManipulationService,
  FeatureFilesManipulationService,
  CodeInsertionService,
  CodeParsingService,
  TestCaseAnalysisService
} from '../../../common/services/code-manipulation';
import { AssistantManagerService } from './assistant-manager.service';
import { ThreadManagerService } from './thread-manager.service';
import { OpenAIConfigService } from './openai-config.service';
import { TestCasesService } from '../../test-cases/services/test-cases.service';
import { TestStepRegistrationService } from '../../test-cases/services/test-step-registration.service';
import { AIGenerationService } from './ai-generation.service';
import { AIGenerationStatus } from '../../test-cases/entities/ai-generation.entity';

/**
 * Test Case Generation Service
 * 
 * Handles AI-powered test case generation using OpenAI's Assistant API.
 * Manages the complete workflow from prompt construction to code insertion
 * and database storage of generated test cases.
 * 
 * @service TestCaseGenerationService
 */
@Injectable()
export class TestCaseGenerationService {
  private readonly logger = new Logger(TestCaseGenerationService.name);
  private openai: OpenAI | null = null;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Endpoint)
    private readonly endpointRepository: Repository<Endpoint>,
    private readonly stepFilesManipulationService: StepFilesManipulationService,
    private readonly featureFilesManipulationService: FeatureFilesManipulationService,
    private readonly codeInsertionService: CodeInsertionService,
    private readonly codeParsingService: CodeParsingService,
    private readonly testCaseAnalysisService: TestCaseAnalysisService,
    private readonly assistantManagerService: AssistantManagerService,
    private readonly threadManagerService: ThreadManagerService,
    @Inject(forwardRef(() => TestCasesService))
    private readonly testCasesService: TestCasesService,
    private readonly testStepRegistrationService: TestStepRegistrationService,
    private readonly openAIConfigService: OpenAIConfigService,
    private readonly aiGenerationService: AIGenerationService,
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
   * Generates test cases using AI with Assistant API.
   * 
   * @param request - The AI generation request parameters
   * @returns Promise<AIGenerationResponse> - The generation response with generated code and metadata
   * @throws Error - If generation fails
   * 
   * @example
   * ```typescript
   * const response = await testCaseGenerationService.generateTestCases({
   *   projectId: 'project-123',
   *   entityName: 'Product',
   *   section: 'ecommerce',
   *   operation: 'add-scenario',
   *   requirements: 'Create product with validation'
   * });
   * ```
   */
  async generateTestCases(request: AIGenerationRequest): Promise<AIGenerationResponse> {
    const startTime = Date.now();
    const generationId = `AI-GEN-${Date.now()}`;
    let totalTokensUsed = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    
    // Fixed names for debug files (always overwrite)
    const debugFiles = {
      prompt: 'ai-generation-prompt.txt',
      response: 'ai-generation-response.txt',
      metadata: 'ai-generation-metadata.json',
      summary: 'ai-generation-summary.json',
      error: 'ai-generation-error.json'
    };
    
    this.logger.log(`🚀 [${generationId}] STARTING TEST GENERATION WITH ASSISTANT API`);
    this.logger.log(`📋 [${generationId}] Request: ${JSON.stringify(request, null, 2)}`);
    
    try {
      // Create record in ai_generations table
      const aiGenerationDto = {
        generationId,
        projectId: request.projectId,
        entityName: request.entityName,
        method: 'POST', // Default, will be updated later
        scenarioName: request.requirements.substring(0, 100), // First 100 characters
        section: request.section,
        requestData: request,
        metadata: {
          operation: request.operation,
          requirements: request.requirements,
        }
      };
      
      await this.aiGenerationService.create(aiGenerationDto);
      this.logger.log(`💾 [${generationId}] Record created in ai_generations table`);
      
      // Configure OpenAI before making the call
      await this.configureOpenAI();
      
      // Update status to processing
      await this.aiGenerationService.updateStatus(generationId, AIGenerationStatus.PROCESSING);
      this.logger.log(`🔄 [${generationId}] Status updated to PROCESSING`);
      
      // Get the project to use its path
      const project = await this.projectRepository.findOneBy({ id: request.projectId });
      if (!project) {
        throw new Error(`Project with ID ${request.projectId} not found`);
      }
      
      this.logger.log(`📁 [${generationId}] Project found: ${project.name} (${project.path})`);
      
      // Create debug directory in playwright-workspaces root
      // const debugDir = path.join(path.dirname(project.path), 'debug');
      // if (!fs.existsSync(debugDir)) {
      //   fs.mkdirSync(debugDir, { recursive: true });
      // }

      // Step 1: Get existing Assistant
      this.logger.log(`🤖 [${generationId}] STEP 1: Getting existing Assistant...`);
      const assistant = await this.assistantManagerService.getAssistant(request.projectId);
      if (!assistant) {
        this.logger.error(`❌ [${generationId}] ERROR: No assistant created for project ${request.projectId}. You must initialize the AI context before generating test cases.`);
        throw new Error(`No assistant created for the project. Initialize the AI context with endpoint /ai/projects/:projectId/assistant/init before generating test cases.`);
      }
      this.logger.log(`✅ [${generationId}] Assistant ready: ${assistant.assistantId}`);

      // Step 2: Create NEW Thread for each generation (avoid history)
      this.logger.log(`🧵 [${generationId}] STEP 2: Creating NEW Thread to avoid history...`);
      let thread = await this.threadManagerService.createThread(request.projectId, assistant.assistantId);
      this.logger.log(`✅ [${generationId}] NEW Thread created: ${thread.threadId} (0/${thread.maxMessages} messages)`);

      // Step 3: Build optimized prompt
      this.logger.log(`📝 [${generationId}] STEP 3: Building optimized prompt...`);
      const { prompt, featureContent, stepsContent } = await this.buildOptimizedPrompt(request);
      this.logger.log(`📤 [${generationId}] Prompt built (${prompt.length} characters)`);
      
      // Save sent prompt
      // const promptPath = path.join(debugDir, debugFiles.prompt);
      // fs.writeFileSync(promptPath, prompt);
      // this.logger.log(`📄 [${generationId}] Prompt saved to: ${promptPath}`);

      // Step 4: Send message to assistant
      this.logger.log(`💬 [${generationId}] STEP 4: Sending message to assistant...`);
      if (!this.openai) {
        throw new Error('OpenAI client not configured');
      }
      const message = await this.openai.beta.threads.messages.create(thread.threadId, {
        role: 'user',
        content: prompt
      });
      this.logger.log(`✅ [${generationId}] Message sent: ${message.id}`);

      // Step 5: Execute run with token optimizations
      this.logger.log(`▶️ [${generationId}] STEP 5: Executing run with optimizations...`);
      if (!this.openai) {
        throw new Error('OpenAI client not configured');
      }
      const run = await this.openai.beta.threads.runs.create(thread.threadId, {
        assistant_id: assistant.assistantId,
        tool_choice: 'auto',
        truncation_strategy: { type: 'auto' }, // Automatically truncates old context
      });
      this.logger.log(`✅ [${generationId}] Optimized run started: ${run.id} (status: ${run.status})`);

      // Step 6: Wait for run completion
      this.logger.log(`⏳ [${generationId}] STEP 6: Waiting for run completion...`);
      const result = await this.waitForRunCompletion(thread.threadId, run.id, generationId);
      this.logger.log(`✅ [${generationId}] Run completed: ${result.status}`);

      // Get real tokens from completed run
      if (result.usage) {
        promptTokens = result.usage.prompt_tokens || 0;
        completionTokens = result.usage.completion_tokens || 0;
        totalTokensUsed = result.usage.total_tokens || 0;
        this.logger.log(`💰 [${generationId}] REAL TOKENS FROM RUN: Prompt=${promptTokens}, Completion=${completionTokens}, Total=${totalTokensUsed}`);
      } else {
        this.logger.warn(`⚠️ [${generationId}] No token usage data found in run`);
        this.logger.log(`🔍 [${generationId}] Run structure: ${JSON.stringify(result, null, 2)}`);
        
        // Try to get usage from run steps
        try {
          if (!this.openai) {
            throw new Error('OpenAI client not configured');
          }
          const runSteps = await this.openai.beta.threads.runs.steps.list(thread.threadId, run.id);
          this.logger.log(`🔍 [${generationId}] Analyzing run steps for token distribution...`);
          
          // Analyze each step to understand token distribution
          for (const step of runSteps.data) {
            if (step.step_details?.type === 'tool_calls') {
              const toolCalls = step.step_details.tool_calls;
              for (const toolCall of toolCalls) {
                if (toolCall.type === 'file_search') {
                  this.logger.log(`🔍 [${generationId}] Tool call: file_search executed`);
                }
              }
            }
            
            if (step.step_details?.type === 'message_creation' && step.step_details.message_creation?.message_id) {
              const messageId = step.step_details.message_creation.message_id;
              if (!this.openai) {
                throw new Error('OpenAI client not configured');
              }
              const message = await this.openai.beta.threads.messages.retrieve(thread.threadId, messageId);
              if ((message as any).usage) {
                promptTokens = (message as any).usage.prompt_tokens || 0;
                completionTokens = (message as any).usage.completion_tokens || 0;
                totalTokensUsed = (message as any).usage.total_tokens || 0;
                this.logger.log(`💰 [${generationId}] REAL TOKENS FROM MESSAGE: Prompt=${promptTokens}, Completion=${completionTokens}, Total=${totalTokensUsed}`);
                break;
              }
            }
          }
        } catch (error) {
          this.logger.warn(`⚠️ [${generationId}] Error getting usage from steps: ${error.message}`);
        }
      }

      // Step 7: Get response
      this.logger.log(`📥 [${generationId}] STEP 7: Getting response...`);
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

      this.logger.log(`📥 [${generationId}] Response received (${generatedText.length} characters)`);
      
      // Save raw response
      // const responsePath = path.join(debugDir, debugFiles.response);
      // fs.writeFileSync(responsePath, generatedText);
      // this.logger.log(`📄 [${generationId}] Response saved to: ${responsePath}`);
      
      // Save response metadata with real tokens
      const responseMetadata = {
        generationId,
        assistantId: assistant.assistantId,
        threadId: thread.threadId,
        runId: run.id,
        runStatus: result.status,
        messageId: lastMessage.id,
        tokenUsage: {
          promptTokens,
          completionTokens,
          totalTokens: totalTokensUsed,
        },
        timestamp: new Date().toISOString(),
      };
      
      // const metadataPath = path.join(debugDir, debugFiles.metadata);
      // fs.writeFileSync(metadataPath, JSON.stringify(responseMetadata, null, 2));
      // this.logger.log(`📄 [${generationId}] Metadata saved to: ${metadataPath}`);
      this.logger.log(`💰 [${generationId}] REAL TOKEN USAGE: Prompt=${promptTokens}, Completion=${completionTokens}, Total=${totalTokensUsed}`);

      // Step 8: Increment message counter
      await this.threadManagerService.incrementMessageCount(thread.threadId);
      this.logger.log(`📊 [${generationId}] Message counter incremented`);

      // Step 9: Parse response to extract code
      this.logger.log(`🔍 [${generationId}] STEP 9: Parsing response...`);
      const parsedCode = this.codeParsingService.parseGeneratedCode(generatedText);
      this.logger.log(`✅ [${generationId}] Code parsed: ${JSON.stringify(parsedCode, null, 2)}`);
      
      // Step 10: Analyze existing files and determine insertion
      this.logger.log(`🔍 [${generationId}] STEP 10: Analyzing existing files...`);
      const insertions = await this.testCaseAnalysisService.analyzeAndDetermineInsertions(request, parsedCode, generationId);
      this.logger.log(`✅ [${generationId}] Insertions determined: ${JSON.stringify(insertions, null, 2)}`);
      
      // Step 11: Insert code into files
      this.logger.log(`📝 [${generationId}] STEP 11: Inserting code into files...`);
      const insertionResult = await this.codeInsertionService.insertCode(insertions, generationId);
      this.logger.log(`✅ [${generationId}] Insertion result: ${JSON.stringify(insertionResult, null, 2)}`);

      // Step 11.5: Save steps to database if steps were inserted
      this.logger.log(`💾 [${generationId}] STEP 11.5: Saving steps to database...`);
      if (parsedCode.steps && parsedCode.steps.trim() && insertionResult.success) {
        try {
          // Check if steps were inserted successfully
          const stepsInserted = insertions.some(insertion => insertion.type === 'step');
          if (stepsInserted) {
            await this.testStepRegistrationService.processStepsFileAndRegisterSteps(
              request.projectId,
              request.section,
              request.entityName
            );
            this.logger.log(`✅ [${generationId}] Steps saved to database successfully`);
          } else {
            this.logger.log(`⚠️ [${generationId}] No steps inserted, skipping database save`);
          }
        } catch (stepDbError) {
          this.logger.error(`❌ [${generationId}] Error saving steps to database: ${stepDbError.message}`);
          // Don't throw error here, just log as error but continue
        }
      } else {
        this.logger.log(`⚠️ [${generationId}] No steps code to save to database`);
      }

      // Step 12: Save test case to database
      this.logger.log(`💾 [${generationId}] STEP 12: Saving test case to database...`);
      let savedTestCase: any = null;
      if (parsedCode.feature && parsedCode.feature.trim()) {
        try {
          // Extract information from generated test case
          const testCaseData = this.extractTestCaseFromGeneratedCode(parsedCode.feature, request);
          if (testCaseData) {
            savedTestCase = await this.testCasesService.createTestCase(request.projectId, testCaseData, true); // true = skip feature insertion
            this.logger.log(`✅ [${generationId}] Test case saved to database: ${savedTestCase.testCaseId}`);
          }
        } catch (dbError) {
          this.logger.error(`❌ [${generationId}] Error saving test case to database: ${dbError.message}`);
          this.logger.error(`❌ [${generationId}] Feature code that caused the error: ${parsedCode.feature}`);
          // Don't throw error here, just log as error but continue
        }
      } else {
        this.logger.warn(`⚠️ [${generationId}] No feature code found to save to database`);
      }

      // Step 13: Files are included directly in the prompt (no vector store)
      this.logger.log(`📤 [${generationId}] STEP 13: Files included directly in prompt`);
      this.logger.log(`📤 [${generationId}] Feature content length: ${featureContent?.length || 0} characters`);
      this.logger.log(`📤 [${generationId}] Steps content length: ${stepsContent?.length || 0} characters`);

      const processingTime = Date.now() - startTime;

      this.logger.log(`🎉 [${generationId}] GENERATION COMPLETED in ${processingTime}ms`);
      this.logger.log(`💰 [${generationId}] FINAL REAL TOKENS: ${totalTokensUsed}`);
      
      // Update status to completed in ai_generations table
      const finalMetadata = {
        modelUsed: assistant.model,
        processingTime,
        tokensUsed: totalTokensUsed,
        filesModified: insertionResult.modifiedFiles,
        newScenarios: [parsedCode.feature ? 'feature' : null, parsedCode.steps ? 'steps' : null].filter(Boolean),
        assistantId: assistant.assistantId,
        threadId: thread.threadId,
        runId: run.id,
      };
      
      // Update method based on generated test case
      if (savedTestCase && savedTestCase.method) {
        try {
          const aiGeneration = await this.aiGenerationService.findByGenerationId(generationId);
          if (aiGeneration) {
            aiGeneration.method = savedTestCase.method;
            await this.aiGenerationService['aiGenerationRepository'].save(aiGeneration);
            this.logger.log(`✅ [${generationId}] Method updated to ${savedTestCase.method} in ai_generations table`);
          }
        } catch (updateError) {
          this.logger.warn(`⚠️ [${generationId}] Error updating method: ${updateError.message}`);
        }
      }
      
      await this.aiGenerationService.markAsCompleted(generationId, parsedCode, finalMetadata);
      this.logger.log(`✅ [${generationId}] Status updated to COMPLETED in ai_generations table`);

      // Save final summary with real tokens
      const summary = {
        generationId,
        request,
        assistantId: assistant.assistantId,
        threadId: thread.threadId,
        runId: run.id,
        newCode: parsedCode,
        insertions,
        insertionResult,
        savedTestCase,
        processingTime,
        tokenUsage: {
          promptTokens,
          completionTokens,
          totalTokens: totalTokensUsed,
        },
        success: true,
        timestamp: new Date().toISOString(),
      };
      
      // const summaryPath = path.join(debugDir, debugFiles.summary);
      // fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
      // this.logger.log(`📄 [${generationId}] Summary saved to: ${summaryPath}`);

      return {
        success: true,
        data: {
          newCode: parsedCode,
          insertions,
          savedTestCase,
        },
        metadata: {
          processingTime,
          tokensUsed: totalTokensUsed,
          modelUsed: assistant.model,
          generationId,
          assistantId: assistant.assistantId,
          threadId: thread.threadId,
        },
      };

    } catch (error) {
      this.logger.error(`❌ [${generationId}] ERROR in test generation: ${error.message}`);
      this.logger.error(`❌ [${generationId}] Stack trace: ${error.stack}`);
      this.logger.error(`💰 [${generationId}] TOKENS CONSUMED BEFORE ERROR: ${totalTokensUsed}`);
      
      // Update status to failed in ai_generations table
      const errorMetadata = {
        processingTime: Date.now() - startTime,
        tokensUsed: totalTokensUsed,
        modelUsed: 'gpt-4o-mini',
        error: error.message,
        stack: error.stack,
      };
      
      try {
        await this.aiGenerationService.markAsFailed(generationId, error.message, errorMetadata);
        this.logger.log(`❌ [${generationId}] Status updated to FAILED in ai_generations table`);
      } catch (dbError) {
        this.logger.error(`❌ [${generationId}] Error updating status in database: ${dbError.message}`);
      }
      
      // Save error with tokens
      const errorLog = {
        generationId,
        request,
        error: error.message,
        stack: error.stack,
        tokenUsage: {
          promptTokens,
          completionTokens,
          totalTokens: totalTokensUsed,
        },
        timestamp: new Date().toISOString(),
      };
      
      // Get the project to use its path
      // const project = await this.projectRepository.findOneBy({ id: request.projectId });
      // if (project) {
      //   const debugDir = path.join(path.dirname(project.path), 'debug');
      //   if (!fs.existsSync(debugDir)) {
      //     fs.mkdirSync(debugDir, { recursive: true });
      //   }
      //   
      //   const errorPath = path.join(debugDir, debugFiles.error);
      //   fs.writeFileSync(errorPath, JSON.stringify(errorLog, null, 2));
      //   this.logger.log(`📄 [${generationId}] Error saved to: ${errorPath}`);
      // }
      
      return {
        success: false,
        error: error.message,
        metadata: {
          processingTime: Date.now() - startTime,
          tokensUsed: totalTokensUsed,
          modelUsed: 'gpt-4o-mini',
          generationId,
        },
      };
    }
  }

  /**
   * Builds an optimized prompt for test case generation.
   * This prompt includes current files directly.
   * 
   * @private
   * @param request - The AI generation request parameters
   * @returns Promise<{ prompt: string; featureContent: string; stepsContent: string }> - The optimized prompt and file contents
   * @throws Error - If project or endpoint not found
   */
  private async buildOptimizedPrompt(request: AIGenerationRequest): Promise<{ prompt: string; featureContent: string; stepsContent: string }> {
    // Get current files for the entity
    const project = await this.projectRepository.findOneBy({ id: request.projectId });
    if (!project) {
      throw new Error(`Project with ID ${request.projectId} not found`);
    }

    let featureContent = '';
    let stepsContent = '';
    let featurePath = '';
    let stepsPath = '';

    // Find the endpoint to get generated files
    const endpoint = await this.endpointRepository.findOne({ 
      where: { projectId: request.projectId, section: request.section, entityName: request.entityName } 
    });

    if (endpoint && endpoint.generatedArtifacts) {
      // Parse generatedArtifacts if it's a JSON string
      let artifacts: any;
      try {
        artifacts = typeof endpoint.generatedArtifacts === 'string'
          ? JSON.parse(endpoint.generatedArtifacts)
          : endpoint.generatedArtifacts;
        
        this.logger.log(`📁 [PROMPT] GeneratedArtifacts parsed: ${JSON.stringify(artifacts, null, 2)}`);
      } catch (e) {
        this.logger.warn(`⚠️ Error parsing generatedArtifacts: ${e.message}`);
        artifacts = {};
      }

      // Read feature file if it exists
      if (artifacts.feature) {
        featurePath = path.join(project.path, artifacts.feature);
        this.logger.log(`📁 [PROMPT] Trying to read feature file: ${featurePath}`);
        
        if (fs.existsSync(featurePath)) {
          featureContent = fs.readFileSync(featurePath, 'utf-8');
          this.logger.log(`✅ [PROMPT] Feature file read successfully (${featureContent.length} characters)`);
        } else {
          this.logger.warn(`⚠️ [PROMPT] Feature file not found: ${featurePath}`);
        }
      } else {
        this.logger.warn(`⚠️ [PROMPT] No feature path found in generatedArtifacts`);
      }

      // Read steps file if it exists
      if (artifacts.steps) {
        stepsPath = path.join(project.path, artifacts.steps);
        this.logger.log(`📁 [PROMPT] Trying to read steps file: ${stepsPath}`);
        
        if (fs.existsSync(stepsPath)) {
          stepsContent = fs.readFileSync(stepsPath, 'utf-8');
          this.logger.log(`✅ [PROMPT] Steps file read successfully (${stepsContent.length} characters)`);
        } else {
          this.logger.warn(`⚠️ [PROMPT] Steps file not found: ${stepsPath}`);
        }
      } else {
        this.logger.warn(`⚠️ [PROMPT] No steps path found in generatedArtifacts`);
      }
    } else {
      this.logger.warn(`⚠️ [PROMPT] No endpoint or generatedArtifacts found for ${request.entityName} (${request.section})`);
    }

    return {
      prompt: `Generate tests for "${request.entityName}" (${request.section}).

OPERATION: ${request.operation}
REQUIREMENTS: ${request.requirements}

📁 CURRENT FILES INCLUDED IN PROMPT:

=== FEATURE FILE (${featurePath || 'Does not exist'}) ===
${featureContent || 'No feature file exists for this entity'}

=== STEPS FILE (${stepsPath || 'Does not exist'}) ===
${stepsContent || 'No steps file exists for this entity'}

📋 DETAILED INSTRUCTIONS:

1. **ANALYSIS OF EXISTING FILES:**
   - Review the FEATURE FILE to see what scenarios already exist
   - Review the STEPS FILE to see what steps are already implemented
   - DO NOT duplicate existing scenarios or steps
   - Identify the next available incremental ID

2. **GENERATION OF NEW CONTENT:**
   - If no feature file exists: Create a new one with Gherkin scenarios
   - If feature file exists: Add only the requested new scenario
   - If no steps file exists: Create a new one with Cucumber steps
   - If steps file exists: Add only the missing steps

3. **STRICT RULES:**
   - REST APIs ONLY
   - DO NOT include "Feature:" or routes in the response
   - Use existing API clients (ProductClient, etc.)
   - Respect sections: Given before "// When steps", When before "// Then steps"
   - Add feature tag and incremental ID: @TC-${request.section}-{entityName}-{Number}
   - DO NOT include duplicate imports
   - Maintain existing format and structure
   - Use specific imports only if necessary

4. **MANDATORY RESPONSE FORMAT:**
   YOU MUST use exactly this format for the system to process your response:

   ***Features:***
   [Here goes the complete feature/scenario code]

   ***Steps:***
   [Here goes the steps code]

   - If you only add feature: Leave ***Steps:*** empty
   - If you only add steps: Leave ***Features:*** empty
   - If you add both: Include both blocks
   - DO NOT include other markers or comments outside these blocks
   - DO NOT include explanatory comments outside the blocks

5. **SPECIFIC STRUCTURE:**
   - FEATURE: Include tags (@create, @smoke, etc.) and the complete scenario
   - STEPS: Include only the new step, without imports if they already exist
   - Maintain exact indentation and format of the existing file

Generate ONLY the necessary code to complete the requested operation using the specified format.`,
      featureContent,
      stepsContent
    };
  }

  /**
   * Waits for a run to complete.
   * 
   * @private
   * @param threadId - The thread ID
   * @param runId - The run ID
   * @param generationId - The generation ID for logging
   * @returns Promise<any> - The completed run object
   * @throws Error - If run fails, is cancelled, expires, or times out
   */
  private async waitForRunCompletion(threadId: string, runId: string, generationId: string): Promise<any> {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes maximum (60 * 5 seconds)
    
    while (attempts < maxAttempts) {
      attempts++;
      this.logger.log(`⏳ [${generationId}] Checking run (attempt ${attempts}/${maxAttempts})...`);
      
      if (!this.openai) {
        throw new Error('OpenAI client not configured');
      }
      const run = await this.openai.beta.threads.runs.retrieve(threadId, runId);
      
      this.logger.log(`📊 [${generationId}] Run status: ${run.status}`);
      
      if (run.status === 'completed') {
        this.logger.log(`✅ [${generationId}] Run completed successfully`);
        
        // Detailed token logging
        if (run.usage) {
          this.logger.log(`💰 [${generationId}] DETAILED TOKENS:`);
          this.logger.log(`   - Prompt: ${run.usage.prompt_tokens || 0}`);
          this.logger.log(`   - Completion: ${run.usage.completion_tokens || 0}`);
          this.logger.log(`   - Total: ${run.usage.total_tokens || 0}`);
          
          // Optimization analysis
          if ((run.usage.prompt_tokens || 0) > 3000) {
            this.logger.warn(`⚠️ [${generationId}] PROMPT TOO HIGH: ${run.usage.prompt_tokens}. Review system prompt and tools.`);
          }
          
          if ((run.usage.total_tokens || 0) > 2000) {
            this.logger.warn(`⚠️ [${generationId}] TOTAL TOO HIGH: ${run.usage.total_tokens}. Review optimizations.`);
          }
        }
        
        return run;
      }
      
      if (run.status === 'failed') {
        this.logger.error(`❌ [${generationId}] Run failed: ${run.last_error?.message || 'Unknown error'}`);
        throw new Error(`Run failed: ${run.last_error?.message || 'Unknown error'}`);
      }
      
      if (run.status === 'cancelled') {
        this.logger.error(`❌ [${generationId}] Run cancelled`);
        throw new Error('Run was cancelled');
      }
      
      if (run.status === 'expired') {
        this.logger.error(`❌ [${generationId}] Run expired`);
        throw new Error('Run expired');
      }
      
      // Wait 5 seconds before next attempt
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    throw new Error(`Run timeout after ${maxAttempts} attempts`);
  }

  /**
   * Extracts test case information from generated feature code.
   * 
   * @private
   * @param featureCode - The generated feature code
   * @param request - The AI generation request
   * @returns any - The extracted test case data
   * @throws Error - If test case ID is not found or extraction fails
   */
  private extractTestCaseFromGeneratedCode(featureCode: string, request: AIGenerationRequest): any {
    try {
      // Check that @TC- exists in the code
      if (!featureCode.includes('@TC-')) {
        throw new Error('No test case ID (@TC-) found in generated response. AI must always generate a test case with format @TC-{section}-{entity}-{number}');
      }

      // Extract the specific test case ID (@TC-...)
      const tcIdMatch = featureCode.match(/@TC-[^\s]+/);
      if (!tcIdMatch) {
        throw new Error('Could not extract test case ID (@TC-...) from generated response');
      }
      const testCaseId = tcIdMatch[0].substring(1); // Remove @ from the beginning

      // Extract all tags from feature code, excluding @TC-
      const tagMatches = featureCode.match(/@([^\s]+)/g);
      const allTags = tagMatches ? tagMatches.map(tag => tag.trim()) : [];
      
      // Filter only functional tags (exclude @TC-)
      const tags = allTags.filter(tag => !tag.startsWith('@TC-'));
      
      // Extract scenario name
      const scenarioMatch = featureCode.match(/Scenario(?: Outline)?:\s*(.+?)(?:\n|$)/i);
      const scenarioName = scenarioMatch ? scenarioMatch[1].trim() : 'AI Generated Test Case';
      
      // Extract scenario description
      const description = scenarioName;
      
      // Determine method based on tags or requirements
      let method = 'GET';
      const requirementsLower = request.requirements.toLowerCase();
      if (requirementsLower.includes('create') || tags.some(tag => tag.includes('create'))) {
        method = 'POST';
      } else if (requirementsLower.includes('update') || tags.some(tag => tag.includes('update'))) {
        method = 'PUT';
      } else if (requirementsLower.includes('delete') || tags.some(tag => tag.includes('delete'))) {
        method = 'DELETE';
      } else if (requirementsLower.includes('get') || requirementsLower.includes('retrieve') || requirementsLower.includes('fetch')) {
        method = 'GET';
      }
      
      // Determine test type based on tags
      let testType = 'positive';
      if (tags.some(tag => tag.includes('negative'))) {
        testType = 'negative';
      }
      
      // The featureCode is already clean from parsing, use it directly
      const cleanedScenario = featureCode.trim();
      
      const testCaseData = {
        section: request.section,
        entityName: request.entityName,
        name: scenarioName,
        description: description,
        method: method,
        testType: testType,
        tags: tags,
        scenario: cleanedScenario,
        testCaseId: testCaseId,
      };

      this.logger.log(`✅ Test case extracted successfully: ${testCaseId} - ${scenarioName}`);
      return testCaseData;
    } catch (error) {
      this.logger.error(`❌ Error extracting test case information: ${error.message}`);
      this.logger.error(`❌ Feature code received: ${featureCode}`);
      throw error; // Re-throw the error to be handled at the upper level
    }
  }
}