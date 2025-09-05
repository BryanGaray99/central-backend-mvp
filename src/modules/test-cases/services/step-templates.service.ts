import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestStep, StepStatus, StepType } from '../entities/test-step.entity';
import { TestStepResponseDto } from '../dto/step-template-response.dto';

@Injectable()
export class StepTemplatesService {
  private readonly logger = new Logger(StepTemplatesService.name);

  constructor(
    @InjectRepository(TestStep)
    private readonly testStepRepository: Repository<TestStep>,
  ) {}


  async getOrganizedStepTemplates(projectId: string): Promise<{
    Given: { common: TestStepResponseDto[]; entity: TestStepResponseDto[] };
    When: { common: TestStepResponseDto[]; entity: TestStepResponseDto[] };
    Then: { common: TestStepResponseDto[]; entity: TestStepResponseDto[] };
  }> {
    this.logger.log(`Getting organized step templates for project ${projectId}`);

    try {
      // Obtener todos los steps del proyecto
      const allSteps = await this.testStepRepository.find({
        where: { projectId, status: StepStatus.ACTIVE },
        order: { type: 'ASC', name: 'ASC' }
      });

      // Organizar por tipo y categoría
      const organized: {
        Given: { common: TestStepResponseDto[]; entity: TestStepResponseDto[] };
        When: { common: TestStepResponseDto[]; entity: TestStepResponseDto[] };
        Then: { common: TestStepResponseDto[]; entity: TestStepResponseDto[] };
      } = {
        Given: { common: [], entity: [] },
        When: { common: [], entity: [] },
        Then: { common: [], entity: [] }
      };

      for (const step of allSteps) {
        const stepDto = this.toTestStepResponseDto(step);
        
        // Determinar si es common o entity-specific basado en el entityName
        const isCommon = step.entityName === 'common' || step.entityName === 'hooks';
        
        if (step.type === StepType.GIVEN) {
          if (isCommon) {
            organized.Given.common.push(stepDto);
          } else {
            organized.Given.entity.push(stepDto);
          }
        } else if (step.type === StepType.WHEN) {
          if (isCommon) {
            organized.When.common.push(stepDto);
          } else {
            organized.When.entity.push(stepDto);
          }
        } else if (step.type === StepType.THEN) {
          if (isCommon) {
            organized.Then.common.push(stepDto);
          } else {
            organized.Then.entity.push(stepDto);
          }
        }
      }

      return organized;
    } catch (error) {
      this.logger.error(`Error getting organized step templates: ${error.message}`, error.stack);
      throw error;
    }
  }

  private toTestStepResponseDto(step: TestStep): TestStepResponseDto {
    return {
      id: step.id,
      stepId: step.stepId,
      projectId: step.projectId,
      name: step.name,
      definition: step.definition,
      type: step.type,
      stepType: step.stepType,
      parameters: step.parameters,
      implementation: step.implementation,
      validation: step.validation,
      status: step.status,
      metadata: step.metadata,
      createdAt: step.createdAt,
      updatedAt: step.updatedAt,
    };
  }
} 