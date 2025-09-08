import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AIGeneration, AIGenerationStatus, AIGenerationType } from '../../test-cases/entities/ai-generation.entity';

/**
 * Interface for creating AI generation records.
 */
export interface CreateAIGenerationDto {
  generationId: string;
  projectId: string;
  entityName: string;
  method: string;
  scenarioName: string;
  section: string;
  requestData?: any;
  generatedCode?: any;
  metadata?: any;
}

/**
 * AI Generation Service
 * 
 * Manages AI generation records in the database, tracking the lifecycle
 * of AI-powered test case generation operations.
 * 
 * @service AIGenerationService
 */
@Injectable()
export class AIGenerationService {
  private readonly logger = new Logger(AIGenerationService.name);

  constructor(
    @InjectRepository(AIGeneration)
    private readonly aiGenerationRepository: Repository<AIGeneration>,
  ) {}

  /**
   * Creates a new AI generation record.
   * 
   * @param dto - The AI generation data to create
   * @returns Promise<AIGeneration> - The created AI generation record
   * @throws Error - If creation fails
   * 
   * @example
   * ```typescript
   * const generation = await aiGenerationService.create({
   *   generationId: 'AI-GEN-123',
   *   projectId: 'project-123',
   *   entityName: 'Product',
   *   method: 'POST',
   *   scenarioName: 'Create Product',
   *   section: 'ecommerce'
   * });
   * ```
   */
  async create(dto: CreateAIGenerationDto): Promise<AIGeneration> {
    try {
      const aiGeneration = new AIGeneration();
      aiGeneration.generationId = dto.generationId;
      aiGeneration.projectId = dto.projectId;
      aiGeneration.entityName = dto.entityName;
      aiGeneration.method = dto.method;
      aiGeneration.scenarioName = dto.scenarioName;
      aiGeneration.section = dto.section;
      aiGeneration.type = AIGenerationType.BDD_TEST_CASE;
      aiGeneration.status = AIGenerationStatus.PENDING;
      aiGeneration.requestData = dto.requestData ? JSON.stringify(dto.requestData) : undefined;
      aiGeneration.generatedCode = dto.generatedCode ? JSON.stringify(dto.generatedCode) : undefined;
      aiGeneration.metadata = dto.metadata || {};

      const saved = await this.aiGenerationRepository.save(aiGeneration);
      this.logger.log(`✅ AI Generation created successfully: ${saved.generationId}`);
      return saved;
    } catch (error) {
      this.logger.error(`❌ Error creating AI Generation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Updates the status of an AI generation record.
   * 
   * @param generationId - The ID of the generation to update
   * @param status - The new status to set
   * @param metadata - Optional additional metadata to merge
   * @returns Promise<AIGeneration> - The updated AI generation record
   * @throws Error - If generation is not found or update fails
   * 
   * @example
   * ```typescript
   * const updated = await aiGenerationService.updateStatus('AI-GEN-123', AIGenerationStatus.PROCESSING);
   * ```
   */
  async updateStatus(generationId: string, status: AIGenerationStatus, metadata?: any): Promise<AIGeneration> {
    try {
      const aiGeneration = await this.aiGenerationRepository.findOne({
        where: { generationId }
      });

      if (!aiGeneration) {
        throw new Error(`AI Generation not found: ${generationId}`);
      }

      aiGeneration.status = status;
      if (metadata) {
        aiGeneration.metadata = { ...aiGeneration.metadata, ...metadata };
      }

      const updated = await this.aiGenerationRepository.save(aiGeneration);
      this.logger.log(`✅ AI Generation ${generationId} updated to status: ${status}`);
      return updated;
    } catch (error) {
      this.logger.error(`❌ Error updating status of AI Generation ${generationId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Marks an AI generation as completed with generated code.
   * 
   * @param generationId - The ID of the generation to mark as completed
   * @param generatedCode - The generated code to store
   * @param metadata - Optional additional metadata to merge
   * @returns Promise<AIGeneration> - The updated AI generation record
   * @throws Error - If generation is not found or update fails
   * 
   * @example
   * ```typescript
   * const completed = await aiGenerationService.markAsCompleted('AI-GEN-123', {
   *   feature: 'Feature: Create Product...',
   *   steps: 'Given I have a product...'
   * });
   * ```
   */
  async markAsCompleted(generationId: string, generatedCode: any, metadata?: any): Promise<AIGeneration> {
    try {
      const aiGeneration = await this.aiGenerationRepository.findOne({
        where: { generationId }
      });

      if (!aiGeneration) {
        throw new Error(`AI Generation not found: ${generationId}`);
      }

      aiGeneration.status = AIGenerationStatus.COMPLETED;
      aiGeneration.generatedCode = JSON.stringify(generatedCode);
      if (metadata) {
        aiGeneration.metadata = { ...aiGeneration.metadata, ...metadata };
      }

      const updated = await this.aiGenerationRepository.save(aiGeneration);
      this.logger.log(`✅ AI Generation ${generationId} marked as completed`);
      return updated;
    } catch (error) {
      this.logger.error(`❌ Error marking AI Generation ${generationId} as completed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Marks an AI generation as failed with error information.
   * 
   * @param generationId - The ID of the generation to mark as failed
   * @param errorMessage - The error message describing the failure
   * @param metadata - Optional additional metadata to merge
   * @returns Promise<AIGeneration> - The updated AI generation record
   * @throws Error - If generation is not found or update fails
   * 
   * @example
   * ```typescript
   * const failed = await aiGenerationService.markAsFailed('AI-GEN-123', 'OpenAI API timeout');
   * ```
   */
  async markAsFailed(generationId: string, errorMessage: string, metadata?: any): Promise<AIGeneration> {
    try {
      const aiGeneration = await this.aiGenerationRepository.findOne({
        where: { generationId }
      });

      if (!aiGeneration) {
        throw new Error(`AI Generation not found: ${generationId}`);
      }

      aiGeneration.status = AIGenerationStatus.FAILED;
      aiGeneration.errorMessage = errorMessage;
      if (metadata) {
        aiGeneration.metadata = { ...aiGeneration.metadata, ...metadata };
      }

      const updated = await this.aiGenerationRepository.save(aiGeneration);
      this.logger.log(`❌ AI Generation ${generationId} marked as failed`);
      return updated;
    } catch (error) {
      this.logger.error(`❌ Error marking AI Generation ${generationId} as failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Finds an AI generation by its generation ID.
   * 
   * @param generationId - The ID of the generation to find
   * @returns Promise<AIGeneration | null> - The AI generation record or null if not found
   * 
   * @example
   * ```typescript
   * const generation = await aiGenerationService.findByGenerationId('AI-GEN-123');
   * ```
   */
  async findByGenerationId(generationId: string): Promise<AIGeneration | null> {
    try {
      return await this.aiGenerationRepository.findOne({
        where: { generationId }
      });
    } catch (error) {
      this.logger.error(`❌ Error searching for AI Generation ${generationId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Finds all AI generations for a specific project.
   * 
   * @param projectId - The ID of the project to find generations for
   * @returns Promise<AIGeneration[]> - Array of AI generation records ordered by creation date
   * 
   * @example
   * ```typescript
   * const generations = await aiGenerationService.findByProjectId('project-123');
   * ```
   */
  async findByProjectId(projectId: string): Promise<AIGeneration[]> {
    try {
      return await this.aiGenerationRepository.find({
        where: { projectId },
        order: { createdAt: 'DESC' }
      });
    } catch (error) {
      this.logger.error(`❌ Error searching for AI Generations of project ${projectId}: ${error.message}`);
      return [];
    }
  }
}
