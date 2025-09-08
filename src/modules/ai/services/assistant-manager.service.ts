import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import { AIAssistant } from '../entities/ai-assistant.entity';
import { Project } from '../../projects/project.entity';
import { ThreadManagerService } from './thread-manager.service';
import { OpenAIConfigService } from './openai-config.service';

/**
 * Assistant Manager Service
 * 
 * Manages AI assistants for projects, including creation, retrieval, verification,
 * and deletion of OpenAI assistants. Handles the lifecycle of AI assistants
 * and their integration with the project system.
 * 
 * @service AssistantManagerService
 */
@Injectable()
export class AssistantManagerService {
  private readonly logger = new Logger(AssistantManagerService.name);
  private openai: OpenAI | null = null;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(AIAssistant)
    private readonly aiAssistantRepository: Repository<AIAssistant>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
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
   * Gets an existing assistant for a project.
   * 
   * @param projectId - The ID of the project
   * @returns Promise<AIAssistant | null> - The AI assistant or null if not found
   * 
   * @example
   * ```typescript
   * const assistant = await assistantManagerService.getAssistant('project-123');
   * ```
   */
  async getAssistant(projectId: string): Promise<AIAssistant | null> {
    this.logger.log(`🔍 Searching for assistant for project ${projectId}`);

    // Configure OpenAI before making the call
    await this.configureOpenAI();

    // Search for existing assistant
    const assistant = await this.aiAssistantRepository.findOne({
      where: { projectId },
      relations: ['project'],
    });

    if (!assistant) {
      this.logger.log(`❌ No assistant found for project ${projectId}`);
      return null;
    }

    this.logger.log(`✅ Assistant found in DB: ${assistant.assistantId}`);
    
    // Verify that the assistant is still active in OpenAI
    try {
      if (!this.openai) {
        throw new Error('OpenAI client not configured');
      }
      await this.openai.beta.assistants.retrieve(assistant.assistantId);
      this.logger.log(`✅ Assistant verified in OpenAI`);
      return assistant;
    } catch (error) {
      this.logger.warn(`⚠️ Assistant not found in OpenAI, removing from DB...`);
      // If it doesn't exist in OpenAI, remove it from DB
      await this.aiAssistantRepository.remove(assistant);
      return null;
    }
  }

  /**
   * Creates a new assistant for a project.
   * 
   * @param projectId - The ID of the project
   * @returns Promise<AIAssistant> - The created AI assistant
   * @throws Error - If assistant already exists or creation fails
   * 
   * @example
   * ```typescript
   * const assistant = await assistantManagerService.createAssistant('project-123');
   * ```
   */
  async createAssistant(projectId: string): Promise<AIAssistant> {
    this.logger.log(`🚀 Creating new assistant for project ${projectId}`);
    
    // Verify that an assistant doesn't already exist
    const existingAssistant = await this.getAssistant(projectId);
    if (existingAssistant) {
      throw new Error(`An assistant already exists for project ${projectId}. Use getAssistant() to retrieve it.`);
    }

    return await this.createAssistantInternal(projectId);
  }

  /**
   * Creates a new assistant for a project (internal method).
   * 
   * @private
   * @param projectId - The ID of the project
   * @returns Promise<AIAssistant> - The created AI assistant
   * @throws Error - If project not found or creation fails
   */
  private async createAssistantInternal(projectId: string): Promise<AIAssistant> {
    // Configure OpenAI before making the call
    await this.configureOpenAI();

    // Get project information
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`);
    }

    // Create assistant in OpenAI (without vector store)
    if (!this.openai) {
      throw new Error('OpenAI client not configured');
    }
    const openaiAssistant = await this.openai.beta.assistants.create({
      name: `API-Test-Bot-${project.name}`,
      instructions: this.buildAssistantInstructions(project),
      model: 'gpt-4o-mini',
      tools: [], // No tools, files will be sent in the prompt
    });
    this.logger.log(`✅ Assistant created in OpenAI: ${openaiAssistant.id}`);

    // Save assistant in DB
    const assistant = new AIAssistant();
    assistant.projectId = projectId;
    assistant.assistantId = openaiAssistant.id;
    assistant.instructions = openaiAssistant.instructions || '';
    assistant.tools = JSON.stringify(openaiAssistant.tools);
    assistant.model = openaiAssistant.model;
    assistant.status = 'active';

    const savedAssistant = await this.aiAssistantRepository.save(assistant);
    this.logger.log(`💾 Assistant saved in DB: ${savedAssistant.id}`);

    // Update project with assistant_id
    await this.projectRepository.update(projectId, {
      assistantId: openaiAssistant.id,
      assistantCreatedAt: new Date(),
    });

    this.logger.log(`📝 Project updated with assistant_id`);

    return savedAssistant;
  }

  /**
   * Builds assistant instructions based on the project.
   * 
   * @private
   * @param project - The project entity
   * @returns string - The formatted instructions for the assistant
   */
  private buildAssistantInstructions(project: Project): string {
    return `You are an assistant specialized in generating REST API tests with Playwright and BDD for ${project.name}.

MAIN INSTRUCTIONS:
1. **CONTEXT ANALYSIS**: Current feature and steps files are included directly in the prompt
2. **INTELLIGENT GENERATION**: Analyze existing files to avoid duplications
3. **CONSISTENT FORMAT**: Maintain the style and structure of existing files
4. **STRUCTURED RESPONSE**: Use the specific format requested in the prompt

STRICT RULES:
1. REST APIs ONLY
2. DO NOT duplicate existing steps or scenarios
3. Respect sections: Given before "// When steps", When before "// Then steps"
4. Add incremental ID: @TC-${project.name}-{entityName}-Number
5. Use existing API clients (ProductClient, etc.)
6. DO NOT include "Feature:" or paths in the response
7. Generate ONLY the code necessary to complete the operation
8. Follow EXACTLY the response format specified in the prompt

CONTEXT: Current files are provided in the prompt so you can analyze them and generate complementary content. The prompt will give you specific instructions about the required response format.`;
  }

  /**
   * Verifies that the assistant has access.
   * 
   * @param projectId - The ID of the project
   * @returns Promise<boolean> - True if assistant has access, false otherwise
   * 
   * @example
   * ```typescript
   * const hasAccess = await assistantManagerService.verifyAssistantAccess('project-123');
   * ```
   */
  async verifyAssistantAccess(projectId: string): Promise<boolean> {
    const assistant = await this.aiAssistantRepository.findOne({
      where: { projectId },
    });

    if (!assistant) {
      return false;
    }

    try {
      // Verify that the assistant exists in OpenAI
      if (!this.openai) {
        throw new Error('OpenAI client not configured');
      }
      await this.openai.beta.assistants.retrieve(assistant.assistantId);
      return true;
    } catch (error) {
      this.logger.warn(`⚠️ Error verifying assistant access: ${error.message}`);
      return false;
    }
  }

  /**
   * Deletes an assistant and all its associated resources.
   * 
   * @param projectId - The ID of the project
   * @returns Promise<void>
   * @throws Error - If deletion fails
   * 
   * @example
   * ```typescript
   * await assistantManagerService.deleteAssistant('project-123');
   * ```
   */
  async deleteAssistant(projectId: string): Promise<void> {
    const assistant = await this.aiAssistantRepository.findOne({
      where: { projectId },
    });

    if (assistant) {
      try {
        this.logger.log(`🗑️ [DELETE] Starting assistant deletion: ${assistant.assistantId}`);
        
        // 1. DELETE THREADS FIRST (to avoid foreign key constraint)
        this.logger.log(`🗑️ [DELETE] Step 1: Deleting threads...`);
        try {
          await this.threadManagerService.deleteAllProjectThreads(projectId);
          this.logger.log(`✅ [DELETE] Threads deleted successfully for project: ${projectId}`);
        } catch (err) {
          this.logger.error(`❌ [DELETE] Error deleting threads: ${err.message}`);
          // Continue with deletion even if it fails
        }

        // 2. CLEAR REFERENCE IN PROJECT (before deleting assistant)
        this.logger.log(`🗑️ [DELETE] Step 2: Clearing reference in project...`);
        try {
          await this.projectRepository.update(projectId, {
            assistantId: undefined,
            assistantCreatedAt: undefined,
          });
          this.logger.log(`✅ [DELETE] Assistant reference cleared in project: ${projectId}`);
        } catch (err) {
          this.logger.error(`❌ [DELETE] Error clearing reference in project: ${err.message}`);
        }

        // 3. DELETE FROM OPENAI
        this.logger.log(`🗑️ [DELETE] Step 3: Deleting from OpenAI...`);
        try {
          if (!this.openai) {
            throw new Error('OpenAI client not configured');
          }
          await this.openai.beta.assistants.del(assistant.assistantId);
          this.logger.log(`✅ [DELETE] Assistant deleted from OpenAI: ${assistant.assistantId}`);
        } catch (err) {
          this.logger.error(`❌ [DELETE] Error deleting assistant from OpenAI: ${err.message}`);
        }

        // 4. DELETE ASSISTANT FROM DB (last step)
        this.logger.log(`🗑️ [DELETE] Step 4: Deleting assistant from DB...`);
        try {
          await this.aiAssistantRepository.remove(assistant);
          this.logger.log(`✅ [DELETE] Assistant deleted from DB successfully`);
        } catch (err) {
          this.logger.error(`❌ [DELETE] Error deleting assistant from DB: ${err.message}`);
          throw err; // Re-throw so user knows it failed
        }
        
        this.logger.log(`🎉 [DELETE] Assistant deletion completed successfully`);
        
      } catch (error) {
        this.logger.error(`💥 [DELETE] General error in deletion: ${error.message}`);
        throw error;
      }
    } else {
      this.logger.warn(`⚠️ [DELETE] No assistant found to delete in project: ${projectId}`);
    }
  }
} 