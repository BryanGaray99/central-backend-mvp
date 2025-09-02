import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AIGeneration, AIGenerationStatus, AIGenerationType } from '../../test-cases/entities/ai-generation.entity';

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

@Injectable()
export class AIGenerationService {
  private readonly logger = new Logger(AIGenerationService.name);

  constructor(
    @InjectRepository(AIGeneration)
    private readonly aiGenerationRepository: Repository<AIGeneration>,
  ) {}

  /**
   * Crea un nuevo registro de AI generation
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
      this.logger.log(`✅ AI Generation creada exitosamente: ${saved.generationId}`);
      return saved;
    } catch (error) {
      this.logger.error(`❌ Error creando AI Generation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Actualiza el status de una AI generation
   */
  async updateStatus(generationId: string, status: AIGenerationStatus, metadata?: any): Promise<AIGeneration> {
    try {
      const aiGeneration = await this.aiGenerationRepository.findOne({
        where: { generationId }
      });

      if (!aiGeneration) {
        throw new Error(`AI Generation no encontrada: ${generationId}`);
      }

      aiGeneration.status = status;
      if (metadata) {
        aiGeneration.metadata = { ...aiGeneration.metadata, ...metadata };
      }

      const updated = await this.aiGenerationRepository.save(aiGeneration);
      this.logger.log(`✅ AI Generation ${generationId} actualizada a status: ${status}`);
      return updated;
    } catch (error) {
      this.logger.error(`❌ Error actualizando status de AI Generation ${generationId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Marca una AI generation como completada
   */
  async markAsCompleted(generationId: string, generatedCode: any, metadata?: any): Promise<AIGeneration> {
    try {
      const aiGeneration = await this.aiGenerationRepository.findOne({
        where: { generationId }
      });

      if (!aiGeneration) {
        throw new Error(`AI Generation no encontrada: ${generationId}`);
      }

      aiGeneration.status = AIGenerationStatus.COMPLETED;
      aiGeneration.generatedCode = JSON.stringify(generatedCode);
      if (metadata) {
        aiGeneration.metadata = { ...aiGeneration.metadata, ...metadata };
      }

      const updated = await this.aiGenerationRepository.save(aiGeneration);
      this.logger.log(`✅ AI Generation ${generationId} marcada como completada`);
      return updated;
    } catch (error) {
      this.logger.error(`❌ Error marcando AI Generation ${generationId} como completada: ${error.message}`);
      throw error;
    }
  }

  /**
   * Marca una AI generation como fallida
   */
  async markAsFailed(generationId: string, errorMessage: string, metadata?: any): Promise<AIGeneration> {
    try {
      const aiGeneration = await this.aiGenerationRepository.findOne({
        where: { generationId }
      });

      if (!aiGeneration) {
        throw new Error(`AI Generation no encontrada: ${generationId}`);
      }

      aiGeneration.status = AIGenerationStatus.FAILED;
      aiGeneration.errorMessage = errorMessage;
      if (metadata) {
        aiGeneration.metadata = { ...aiGeneration.metadata, ...metadata };
      }

      const updated = await this.aiGenerationRepository.save(aiGeneration);
      this.logger.log(`❌ AI Generation ${generationId} marcada como fallida`);
      return updated;
    } catch (error) {
      this.logger.error(`❌ Error marcando AI Generation ${generationId} como fallida: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene una AI generation por ID
   */
  async findByGenerationId(generationId: string): Promise<AIGeneration | null> {
    try {
      return await this.aiGenerationRepository.findOne({
        where: { generationId }
      });
    } catch (error) {
      this.logger.error(`❌ Error buscando AI Generation ${generationId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Obtiene todas las AI generations de un proyecto
   */
  async findByProjectId(projectId: string): Promise<AIGeneration[]> {
    try {
      return await this.aiGenerationRepository.find({
        where: { projectId },
        order: { createdAt: 'DESC' }
      });
    } catch (error) {
      this.logger.error(`❌ Error buscando AI Generations del proyecto ${projectId}: ${error.message}`);
      return [];
    }
  }
}
