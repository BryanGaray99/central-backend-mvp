import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestStep, StepStatus, StepType } from '../entities/test-step.entity';
import { TestStepResponseDto } from '../dto/step-template-response.dto';

/**
 * Step Templates Service
 *
 * This service manages test step templates and provides organized access to them.
 * It handles retrieving and organizing step templates by Gherkin type (Given/When/Then)
 * and category (common vs entity-specific steps) for easy selection in test case creation.
 *
 * @class StepTemplatesService
 * @since 1.0.0
 */
@Injectable()
export class StepTemplatesService {
  private readonly logger = new Logger(StepTemplatesService.name);

  constructor(
    @InjectRepository(TestStep)
    private readonly testStepRepository: Repository<TestStep>,
  ) {}


  /**
   * Gets organized step templates by Gherkin type and category.
   *
   * This method retrieves all active test steps for a project and organizes them
   * by Gherkin type (Given/When/Then) and category (common vs entity-specific).
   * This organization makes it easier for users to select appropriate steps
   * when creating test cases.
   *
   * @param projectId - The ID of the project to get step templates for
   * @returns Promise resolving to organized step templates structure
   * @throws Error when database operations fail
   *
   * @example
   * ```typescript
   * const templates = await stepTemplatesService.getOrganizedStepTemplates('project-123');
   * console.log(templates.Given.common); // Common Given steps
   * console.log(templates.When.entity); // Entity-specific When steps
   * ```
   */
  async getOrganizedStepTemplates(projectId: string): Promise<{
    Given: { common: TestStepResponseDto[]; entity: TestStepResponseDto[] };
    When: { common: TestStepResponseDto[]; entity: TestStepResponseDto[] };
    Then: { common: TestStepResponseDto[]; entity: TestStepResponseDto[] };
  }> {
    this.logger.log(`Getting organized step templates for project ${projectId}`);

    try {
      // Get all steps from the project
      const allSteps = await this.testStepRepository.find({
        where: { projectId, status: StepStatus.ACTIVE },
        order: { type: 'ASC', name: 'ASC' }
      });

      // Organize by type and category
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
        
        // Determine if it's common or entity-specific based on entityName
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

  /**
   * Converts a TestStep entity to a TestStepResponseDto.
   *
   * This private method transforms a TestStep database entity into a response DTO
   * for API consumption, mapping all relevant properties.
   *
   * @private
   * @param step - The TestStep entity to convert
   * @returns TestStepResponseDto with all step information
   */
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