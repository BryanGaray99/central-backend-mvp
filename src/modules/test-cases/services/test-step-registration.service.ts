import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestStep, StepType, StepTemplateType, StepStatus } from '../entities/test-step.entity';
import { Project } from '../../projects/project.entity';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Test Step Registration Service
 *
 * This service handles the registration of test steps from step definition files.
 * It processes Playwright step definition files, extracts step functions, and
 * registers them as reusable test steps in the database with proper metadata.
 *
 * @class TestStepRegistrationService
 * @since 1.0.0
 */
@Injectable()
export class TestStepRegistrationService {
  private readonly logger = new Logger(TestStepRegistrationService.name);

  constructor(
    @InjectRepository(TestStep)
    private readonly testStepRepository: Repository<TestStep>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  /**
   * Processes a steps file and registers all test steps found in it.
   *
   * This method reads a Playwright step definition file, extracts step functions,
   * and registers each one in the database as a reusable test step.
   *
   * @param projectId - The ID of the project
   * @param section - The section/category name
   * @param entityName - The entity name
   * @returns Promise that resolves when all steps are registered
   * @throws Error when file processing or database operations fail
   *
   * @example
   * ```typescript
   * await service.processStepsFileAndRegisterSteps('project-123', 'ecommerce', 'Product');
   * ```
   */
  async processStepsFileAndRegisterSteps(
    projectId: string,
    section: string,
    entityName: string,
  ): Promise<void> {
    try {
      const project = await this.projectRepository.findOne({ where: { id: projectId } });
      if (!project) throw new Error(`Project with ID ${projectId} not found`);

      const stepsFilePath = path.join(
        project.path,
        'src',
        'steps',
        section,
        `${entityName.toLowerCase()}.steps.ts`
      );

      const stepsContent = await fs.readFile(stepsFilePath, 'utf-8');
      const lines = stepsContent.split('\n');

      const steps = this.extractStepsFromFile(lines, projectId, section, entityName);
      
      for (const step of steps) {
        await this.createStepFromFile(step);
      }

      this.logger.log(`Registered ${steps.length} steps for ${entityName} in section ${section}`);
    } catch (error) {
      this.logger.error(`Error processing steps file:`, error);
      throw error;
    }
  }

  /**
   * Extracts test step definitions from a file's lines.
   *
   * This private method processes file lines to extract Playwright step definitions,
   * including their complete implementation, parameters, and metadata.
   *
   * @private
   * @param lines - Array of file lines to process
   * @param projectId - The ID of the project
   * @param section - The section/category name
   * @param entityName - The entity name
   * @returns Array of extracted step objects with metadata
   */
  private extractStepsFromFile(
    lines: string[],
    projectId: string,
    section: string,
    entityName: string,
  ): Array<{
    projectId: string;
    section: string;
    entityName: string;
    stepId: string;
    name: string;
    definition: string;
    type: StepType;
    implementation: string;
    parameters: any[];
  }> {
    const steps: Array<{
      projectId: string;
      section: string;
      entityName: string;
      stepId: string;
      name: string;
      definition: string;
      type: StepType;
      implementation: string;
      parameters: any[];
    }> = [];

    let stepNumber = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      const stepMatch = line.match(/^(Given|When|Then|And|But)\s*\(\s*['"`]([^'"`]+)['"`]/);
      if (stepMatch) {
        const stepType = stepMatch[1] as StepType;
        const stepName = stepMatch[2];
        const stepId = `ST-${section.toUpperCase()}-${entityName.toUpperCase()}-${String(stepNumber).padStart(2, '0')}`;

        // Extract the complete implementation of the step
        let implementation = '';
        let definition = '';
        let braceCount = 0;
        let startIndex = i;

        // Search from the current line until finding the step closure
        for (let j = i; j < lines.length; j++) {
          const funcLine = lines[j];
          
          // Count opening and closing braces
          for (let char of funcLine) {
            if (char === '{') {
              braceCount++;
            } else if (char === '}') {
              braceCount--;
            }
          }

          if (funcLine.includes('});') && braceCount === 0) {
            // Extract the entire implementation from the definition line to the closure
            implementation = lines.slice(i, j + 1).join('\n');
            definition = implementation; // The complete definition equals the implementation
            break;
          }
        }

        // If no implementation was found, create a basic one
        if (!implementation) {
          implementation = `function () { }`;
          definition = `${stepType}('${stepName}', function () { });`;
        }

        const step = {
          projectId,
          section,
          entityName,
          stepId,
          name: stepName,
          definition: definition,
          type: stepType,
          implementation: implementation,
          parameters: this.extractParametersFromStepName(stepName),
        };

        steps.push(step);
        stepNumber++;
      }
    }

    return steps;
  }

  /**
   * Extracts parameters from a step name definition.
   *
   * This private method analyzes a step name to extract parameter definitions
   * in the format {parameterName} and returns them as parameter objects.
   *
   * @private
   * @param stepName - The step name containing parameter definitions
   * @returns Array of parameter objects with name, type, and metadata
   */
  private extractParametersFromStepName(stepName: string): any[] {
    const parameters: any[] = [];
    
    // Search for parameters in the format {string}, {number}, etc.
    const paramMatches = stepName.match(/\{([^}]+)\}/g);
    if (paramMatches) {
      paramMatches.forEach((match, index) => {
        const paramName = match.replace(/\{|\}/g, '');
        parameters.push({
          name: paramName,
          type: 'string',
          required: true,
          defaultValue: undefined,
        });
      });
    }

    return parameters;
  }

  /**
   * Creates a test step entity from extracted step data and saves it to the database.
   *
   * This private method creates a new TestStep entity with the provided step data
   * and saves it to the database, skipping if a step with the same ID already exists.
   *
   * @private
   * @param stepData - The step data object containing all step information
   * @returns Promise that resolves when the step is saved to the database
   */
  private async createStepFromFile(stepData: {
    projectId: string;
    section: string;
    entityName: string;
    stepId: string;
    name: string;
    definition: string;
    type: StepType;
    implementation: string;
    parameters: any[];
  }): Promise<void> {

    const existingStep = await this.testStepRepository.findOne({
      where: { stepId: stepData.stepId },
    });

    if (existingStep) {
      this.logger.log(`Step ${stepData.stepId} already exists, skipping...`);
      return;
    }

    const testStep = this.testStepRepository.create({
      stepId: stepData.stepId,
      projectId: stepData.projectId,
      section: stepData.section,
      entityName: stepData.entityName,
      name: stepData.name,
      definition: stepData.definition,
      type: stepData.type,
      stepType: StepTemplateType.PREDEFINED,
      parameters: stepData.parameters,
      implementation: stepData.implementation,
      status: StepStatus.ACTIVE,
    });

    await this.testStepRepository.save(testStep);
    this.logger.log(`Registered step: ${stepData.stepId} - ${stepData.name}`);
  }

  /**
   * Gets the next available step number for a given project, section, and entity.
   *
   * This method searches for existing test steps with the pattern ST-{SECTION}-{ENTITYNAME}-{NUMBER}
   * and returns the next sequential number to use for a new test step.
   *
   * @param projectId - The ID of the project
   * @param section - The section/category name
   * @param entityName - The entity name
   * @returns Promise resolving to the next available step number
   *
   * @example
   * ```typescript
   * const nextNumber = await service.getNextStepNumber('project-123', 'ecommerce', 'Product');
   * // Returns 6 if ST-ECOMMERCE-PRODUCT-5 is the highest existing number
   * ```
   */
  async getNextStepNumber(projectId: string, section: string, entityName: string): Promise<number> {
    const pattern = `ST-${section.toUpperCase()}-${entityName.toUpperCase()}-`;
    const steps = await this.testStepRepository
      .createQueryBuilder('step')
      .where('step.projectId = :projectId', { projectId })
      .andWhere('step.stepId LIKE :pattern', { pattern: `${pattern}%` })
      .getMany();
    
    let maxNumber = 0;
    for (const step of steps) {
      const match = step.stepId.match(new RegExp(`${pattern}(\\d+)`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) maxNumber = num;
      }
    }
    return maxNumber + 1;
  }

  /**
   * Deletes all test steps for a specific project, section, and entity combination.
   *
   * This method removes all test steps that match the specified project ID,
   * section, and entity name from the database.
   *
   * @param projectId - The ID of the project
   * @param section - The section/category name
   * @param entityName - The entity name
   * @returns Promise that resolves when all matching test steps are deleted
   * @throws Error when database operations fail
   *
   * @example
   * ```typescript
   * await service.deleteTestStepsByProjectSectionEntity('project-123', 'ecommerce', 'Product');
   * ```
   */
  async deleteTestStepsByProjectSectionEntity(projectId: string, section: string, entityName: string): Promise<void> {
    this.logger.log(`Deleting all test steps for projectId=${projectId}, section=${section}, entityName=${entityName}`);
    try {
      await this.testStepRepository.delete({ projectId, section, entityName });
      this.logger.log(`All test steps deleted for projectId=${projectId}, section=${section}, entityName=${entityName}`);
    } catch (error) {
      this.logger.error('Error deleting test steps by project/section/entity:', error);
      throw error;
    }
  }

  /**
   * Lists test steps for a project with filtering and pagination.
   *
   * This method retrieves test steps for a specific project with support for
   * filtering by various criteria and pagination. It applies filters for
   * section, entity name, type, status, and search terms.
   *
   * @param projectId - The ID of the project to list test steps for
   * @param filters - Filtering and pagination criteria
   * @returns Promise resolving to paginated list of test steps with metadata
   * @throws Error when database operations fail
   *
   * @example
   * ```typescript
   * const result = await service.listTestSteps('project-123', {
   *   page: 1,
   *   limit: 20,
   *   section: 'ecommerce',
   *   type: 'Given',
   *   search: 'create'
   * });
   * ```
   */
  async listTestSteps(
    projectId: string,
    filters: any,
  ): Promise<{
    testSteps: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    filters: any;
  }> {
    this.logger.log(`Listing test steps for projectId=${projectId} with filters:`, filters);
    
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;
    
    // Build query with filters
    const queryBuilder = this.testStepRepository
      .createQueryBuilder('step')
      .where('step.projectId = :projectId', { projectId });

    if (filters.section) {
      queryBuilder.andWhere('step.section = :section', { section: filters.section });
    }

    if (filters.entityName) {
      queryBuilder.andWhere('step.entityName = :entityName', { entityName: filters.entityName });
    }

    if (filters.type) {
      queryBuilder.andWhere('step.type = :type', { type: filters.type });
    }

    if (filters.status) {
      queryBuilder.andWhere('step.status = :status', { status: filters.status });
    }

    if (filters.search) {
      queryBuilder.andWhere(
        '(step.name LIKE :search OR step.definition LIKE :search)',
        { search: `%${filters.search}%` }
      );
    }

    // Count total
    const total = await queryBuilder.getCount();

    // Apply sorting
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'DESC';
    queryBuilder.orderBy(`step.${sortBy}`, sortOrder);

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    // Execute query
    const testSteps = await queryBuilder.getMany();

    const totalPages = Math.ceil(total / limit);

    return {
      testSteps,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      filters,
    };
  }

  /**
   * Gets comprehensive statistics for test steps in a project.
   *
   * This method provides detailed statistics about test steps including counts
   * by type, section, entity, status, and last update information.
   *
   * @param projectId - The ID of the project to get statistics for
   * @returns Promise resolving to comprehensive step statistics
   * @throws Error when database operations fail
   *
   * @example
   * ```typescript
   * const stats = await service.getStatistics('project-123');
   * console.log(`Total steps: ${stats.totalSteps}`);
   * console.log(`Active steps: ${stats.activeSteps}`);
   * ```
   */
  async getStatistics(projectId: string): Promise<{
    totalSteps: number;
    activeSteps: number;
    deprecatedSteps: number;
    stepsByType: Record<string, number>;
    stepsBySection: Record<string, number>;
    stepsByEntity: Record<string, number>;
    lastUpdated: Date;
  }> {
    this.logger.log(`Getting statistics for projectId=${projectId}`);

    const totalSteps = await this.testStepRepository.count({ where: { projectId } });
    const activeSteps = await this.testStepRepository.count({ where: { projectId, status: StepStatus.ACTIVE } });
    const deprecatedSteps = await this.testStepRepository.count({ where: { projectId, status: StepStatus.DEPRECATED } });

    // Steps por tipo
    const stepsByType = await this.testStepRepository
      .createQueryBuilder('step')
      .select('step.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('step.projectId = :projectId', { projectId })
      .groupBy('step.type')
      .getRawMany();

    // Steps by section
    const stepsBySection = await this.testStepRepository
      .createQueryBuilder('step')
      .select('step.section', 'section')
      .addSelect('COUNT(*)', 'count')
      .where('step.projectId = :projectId', { projectId })
      .groupBy('step.section')
      .getRawMany();

    // Steps by entity
    const stepsByEntity = await this.testStepRepository
      .createQueryBuilder('step')
      .select('step.entityName', 'entityName')
      .addSelect('COUNT(*)', 'count')
      .where('step.projectId = :projectId', { projectId })
      .groupBy('step.entityName')
      .getRawMany();

    // Last update
    const lastUpdated = await this.testStepRepository
      .createQueryBuilder('step')
      .select('MAX(step.updatedAt)', 'lastUpdated')
      .where('step.projectId = :projectId', { projectId })
      .getRawOne();

    return {
      totalSteps,
      activeSteps,
      deprecatedSteps,
      stepsByType: stepsByType.reduce((acc, item) => {
        acc[item.type] = parseInt(item.count);
        return acc;
      }, {} as Record<string, number>),
      stepsBySection: stepsBySection.reduce((acc, item) => {
        acc[item.section] = parseInt(item.count);
        return acc;
      }, {} as Record<string, number>),
      stepsByEntity: stepsByEntity.reduce((acc, item) => {
        acc[item.entityName] = parseInt(item.count);
        return acc;
      }, {} as Record<string, number>),
      lastUpdated: lastUpdated?.lastUpdated || new Date(),
    };
  }

  /**
   * Finds a test step by its ID.
   *
   * This method retrieves a test step from the database by its unique step ID.
   *
   * @param stepId - The unique identifier of the test step
   * @returns Promise resolving to the test step entity
   * @throws Error when test step is not found
   *
   * @example
   * ```typescript
   * const step = await service.findByStepId('ST-ECOMMERCE-01');
   * ```
   */
  async findByStepId(stepId: string): Promise<any> {
    this.logger.log(`Finding test step by stepId=${stepId}`);
    
    const testStep = await this.testStepRepository.findOne({
      where: { stepId },
    });

    if (!testStep) {
      throw new Error(`Test step with stepId ${stepId} not found`);
    }

    return testStep;
  }

  /**
   * Deletes a test step by its ID.
   *
   * This method removes a test step from the database by its unique step ID.
   *
   * @param stepId - The unique identifier of the test step to delete
   * @returns Promise that resolves when the test step is deleted
   * @throws Error when test step is not found or deletion fails
   *
   * @example
   * ```typescript
   * await service.deleteTestStep('ST-ECOMMERCE-01');
   * ```
   */
  async deleteTestStep(stepId: string): Promise<void> {
    this.logger.log(`Deleting test step with stepId=${stepId}`);
    
    const testStep = await this.testStepRepository.findOne({
      where: { stepId },
    });

    if (!testStep) {
      throw new Error(`Test step with stepId ${stepId} not found`);
    }

    await this.testStepRepository.remove(testStep);
    this.logger.log(`Test step ${stepId} deleted successfully`);
  }
} 