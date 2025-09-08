import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestCase, TestCaseStatus, TestType } from '../entities/test-case.entity';
import { TestStep } from '../entities/test-step.entity';
import { CreateTestCaseDto } from '../dto/create-test-case.dto';
import { UpdateTestCaseDto } from '../dto/update-test-case.dto';
import { TestCaseFiltersDto } from '../dto/test-case-filters.dto';
import { TestCaseListResponse, TestCaseStatistics, TestCaseExport } from '../interfaces/test-case.interface';
import { FeatureFileManagerService } from './feature-file-manager.service';
import { TestCaseResponseDto } from '../dto/test-case-response.dto';
import { TestCaseStatisticsDto } from '../dto/test-case-statistics.dto';

// Temporary interfaces for TODO methods
interface TestCaseListResponseDto {
  testCases: TestCaseResponseDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: TestCaseFiltersDto;
}

interface TestCaseExportDto {
  testCaseId: string;
  name: string;
  description: string;
  tags: string[];
  gherkin: string;
  metadata: {
    entityName: string;
    method: string;
    testType: string;
    priority?: string;
    complexity?: string;
  };
}



/**
 * Test Cases Service
 *
 * This service provides comprehensive test case management functionality including
 * CRUD operations, filtering, pagination, statistics, and integration with feature files.
 * It handles test case creation, updates, deletion, and provides various query methods
 * for retrieving test cases with different criteria.
 *
 * @class TestCasesService
 * @since 1.0.0
 */
@Injectable()
export class TestCasesService {
  private readonly logger = new Logger(TestCasesService.name);

  constructor(
    @InjectRepository(TestCase)
    private readonly testCaseRepository: Repository<TestCase>,
    @InjectRepository(TestStep)
    private readonly testStepRepository: Repository<TestStep>,
    private readonly featureFileManagerService: FeatureFileManagerService,
  ) {}

  /**
   * Creates a new test case for the specified project.
   *
   * This method validates input data, generates a unique test case ID,
   * saves the test case to the database, and optionally adds it to the feature file.
   *
   * @param projectId - The ID of the project to create the test case in
   * @param dto - The test case creation data
   * @param skipFeatureInsertion - Whether to skip adding the test case to the feature file
   * @returns Promise resolving to the created test case response
   * @throws Error when validation fails or database operations fail
   *
   * @example
   * ```typescript
   * const testCase = await service.createTestCase('project-123', {
   *   name: 'Create Product Test',
   *   description: 'Test product creation',
   *   entityName: 'Product',
   *   section: 'ecommerce',
   *   method: 'POST',
   *   scenario: 'Given I have valid data\nWhen I create a product\nThen it should be created'
   * });
   * ```
   */
  async createTestCase(projectId: string, dto: CreateTestCaseDto, skipFeatureInsertion: boolean = false): Promise<TestCaseResponseDto> {
    this.logger.log(`Creating test case for project ${projectId}`);

    try {
      // 1. Validate input data
      await this.validateTestCase(dto);

      // 2. Determine the test case ID
      let testCaseId: string;
      if (skipFeatureInsertion && dto.testCaseId) {
        // For AI-generated test cases, use the ID that already comes in the DTO
        testCaseId = dto.testCaseId;
        this.logger.log(`Using AI-generated test case ID: ${testCaseId}`);
      } else {
        // For normal test cases, generate unique ID (based on existing database)
        testCaseId = await this.generateTestCaseId(projectId, dto.section, dto.entityName);
      }

      // 3. Create test case in database (ensure that projectId from path takes precedence)
      const testCase = this.testCaseRepository.create({
        ...dto,
        testCaseId,
        projectId,
      });

      const savedTestCase = await this.testCaseRepository.save(testCase);

      // 4. Append scenario to feature file (only if insertion was not skipped)
      if (!skipFeatureInsertion) {
        try {
          await this.featureFileManagerService.addTestCaseToFeature(
            projectId,
            dto.section,
            dto.entityName,
            savedTestCase
          );
        } catch (featureError) {
          this.logger.warn(`Warning: Could not append scenario to feature file: ${featureError.message}`);
        }
      } else {
        this.logger.log(`Skipping feature file insertion for AI-generated test case: ${testCaseId}`);
      }

      this.logger.log(`Test case created successfully: ${testCaseId}`);
      return this.toTestCaseResponseDto(savedTestCase);
    } catch (error) {
      this.logger.error('Error creating test case:', error);
      throw error;
    }
  }

  /**
   * Updates an existing test case.
   *
   * This method validates input data, updates the test case in the database,
   * and updates the corresponding feature file.
   *
   * @param testCaseId - The ID of the test case to update
   * @param dto - The update data for the test case
   * @returns Promise resolving to the updated test case response
   * @throws Error when test case is not found or validation fails
   *
   * @example
   * ```typescript
   * const updated = await service.updateTestCase('TC-ECOMMERCE-01', {
   *   name: 'Updated Test Case Name',
   *   description: 'Updated description'
   * });
   * ```
   */
  async updateTestCase(testCaseId: string, dto: UpdateTestCaseDto): Promise<TestCaseResponseDto> {
    this.logger.log(`Updating test case: ${testCaseId}`);

    try {
      const testCase = await this.findTestCaseEntityById(testCaseId);
      
      // 1. Validate input data
      await this.validateTestCase({ ...testCase, ...dto });

      // 2. Update in database
      const updatedTestCase = await this.testCaseRepository.save({
        ...testCase,
        ...dto,
      });

      // 3. Update feature files
      try {
        await this.featureFileManagerService.updateTestCaseInFeature(
          testCase.projectId,
          testCase.section,
          testCase.entityName,
          updatedTestCase
        );
        this.logger.log(`Test case updated in feature file: ${testCaseId}`);
      } catch (featureError) {
        this.logger.warn(`Warning: Could not update test case in feature file: ${featureError.message}`);
        // Don't throw error here, just log as warning
      }

      this.logger.log(`Test case updated successfully: ${testCaseId}`);
      return this.toTestCaseResponseDto(updatedTestCase);
    } catch (error) {
      this.logger.error('Error updating test case:', error);
      throw error;
    }
  }

  /**
   * Updates test case steps with organized step selection.
   *
   * This method updates a test case with new steps, tags, and scenario structure.
   * It reconstructs the scenario based on selected steps and updates both the
   * database and feature files.
   *
   * @param projectId - The ID of the project containing the test case
   * @param testCaseId - The ID of the test case to update
   * @param dto - The step update data including tags, steps, and scenario
   * @returns Promise resolving to the updated test case response
   * @throws Error when test case is not found or step processing fails
   *
   * @example
   * ```typescript
   * const updated = await service.updateTestCaseSteps('project-123', 'TC-ECOMMERCE-01', {
   *   tags: ['@smoke', '@api'],
   *   steps: [
   *     { type: 'Given', stepId: 'ST-SETUP-01' },
   *     { type: 'When', stepId: 'ST-CREATE-01' },
   *     { type: 'Then', stepId: 'ST-VERIFY-01' }
   *   ],
   *   scenario: 'Given I have valid data\nWhen I create a product\nThen it should be created'
   * });
   * ```
   */
  async updateTestCaseSteps(
    projectId: string, 
    testCaseId: string, 
    dto: {
      tags: string[];
      steps: {
        type: 'Given' | 'When' | 'Then' | 'And';
        stepId: string;
        parameters?: Record<string, any>;
      }[];
      scenario: string;
    }
  ): Promise<TestCaseResponseDto> {
    this.logger.log(`Updating test case steps: ${testCaseId}`);

    try {
      const testCase = await this.findTestCaseEntityById(testCaseId);
      
      // 1. Reconstruct the scenario based on selected steps
      const scenarioSteps = dto.steps.map(step => {
        const stepType = step.type === 'And' ? this.getPreviousStepType(dto.steps, dto.steps.indexOf(step)) : step.type;
        return `${stepType} ${this.getStepDefinition(step.stepId, step.parameters)}`;
      });

      const newScenario = scenarioSteps.join('\n    ');

      // 2. Update test case with new data
      const updatedTestCase = await this.testCaseRepository.save({
        ...testCase,
        tags: dto.tags,
        scenario: newScenario,
      });

      // 3. Update feature files
      try {
        await this.featureFileManagerService.updateTestCaseInFeature(
          testCase.projectId,
          testCase.section,
          testCase.entityName,
          updatedTestCase
        );
        this.logger.log(`Test case steps updated in feature file: ${testCaseId}`);
      } catch (featureError) {
        this.logger.warn(`Warning: Could not update test case steps in feature file: ${featureError.message}`);
      }

      this.logger.log(`Test case steps updated successfully: ${testCaseId}`);
      return this.toTestCaseResponseDto(updatedTestCase);
    } catch (error) {
      this.logger.error('Error updating test case steps:', error);
      throw error;
    }
  }

  /**
   * Updates test case scenario with complete text.
   *
   * This method updates a test case with new tags and complete scenario text.
   * It processes tags and updates both the database and feature files.
   *
   * @param projectId - The ID of the project containing the test case
   * @param testCaseId - The ID of the test case to update
   * @param dto - The scenario update data including tags and scenario text
   * @returns Promise resolving to the updated test case response
   * @throws Error when test case is not found or validation fails
   *
   * @example
   * ```typescript
   * const updated = await service.updateTestCaseScenario('project-123', 'TC-ECOMMERCE-01', {
   *   tags: ['@smoke', '@api'],
   *   scenario: 'Given I have valid product data\nWhen I send a POST request\nThen the product should be created successfully'
   * });
   * ```
   */
  async updateTestCaseScenario(
    projectId: string, 
    testCaseId: string, 
    dto: {
      tags: string[];
      scenario: string;
    }
  ): Promise<TestCaseResponseDto> {
    this.logger.log(`Updating test case scenario: ${testCaseId}`);

    try {
      const testCase = await this.findTestCaseEntityById(testCaseId);
      
      // Process tags - handle both array of strings and array with string containing spaces
      let processedTags = dto.tags;
      if (Array.isArray(dto.tags) && dto.tags.length === 1 && typeof dto.tags[0] === 'string' && dto.tags[0].includes(' ')) {
        // If tags come as ["@read @smoke"], split them
        processedTags = dto.tags[0].split(' ').filter(tag => tag.trim() !== '');
      }
      
      // 1. Validate input data (same pattern as updateTestCase)
      await this.validateTestCase({ ...testCase, tags: processedTags, scenario: dto.scenario });

      // 2. Update in database using the same pattern as updateTestCase
      const updatedTestCase = await this.testCaseRepository.save({
        ...testCase,
        tags: processedTags,
        scenario: dto.scenario,
      });

      // 3. Update feature files
      try {
        await this.featureFileManagerService.updateTestCaseInFeature(
          testCase.projectId,
          testCase.section,
          testCase.entityName,
          updatedTestCase
        );
        this.logger.log(`Test case scenario updated in feature file: ${testCaseId}`);
      } catch (featureError) {
        this.logger.warn(`Warning: Could not update test case scenario in feature file: ${featureError.message}`);
      }

      this.logger.log(`Test case scenario updated successfully: ${testCaseId}`);
      return this.toTestCaseResponseDto(updatedTestCase);
    } catch (error) {
      this.logger.error('Error updating test case scenario:', error);
      throw error;
    }
  }

  /**
   * Gets the previous step type for 'And' steps.
   *
   * This private method determines the correct step type for 'And' steps
   * by looking at the previous non-'And' step in the sequence.
   *
   * @private
   * @param steps - Array of step objects
   * @param currentIndex - Current step index
   * @returns The step type to use for the 'And' step
   */
  private getPreviousStepType(steps: any[], currentIndex: number): string {
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (steps[i].type !== 'And') {
        return steps[i].type;
      }
    }
    return 'Given'; // Default fallback
  }

  /**
   * Gets step definition with parameter substitution.
   *
   * This private method retrieves a step definition from the database
   * and substitutes any provided parameters into the definition.
   *
   * @private
   * @param stepId - The ID of the step to retrieve
   * @param parameters - Optional parameters to substitute in the definition
   * @returns Promise resolving to the step definition with substituted parameters
   * @throws Error when step is not found
   */
  private async getStepDefinition(stepId: string, parameters?: Record<string, any>): Promise<string> {
    // Search for the step in the database
    const step = await this.testStepRepository.findOne({ where: { stepId } });
    if (!step) {
      throw new Error(`Step not found: ${stepId}`);
    }

    let definition = step.definition;
    
    // Replace parameters if they exist
    if (parameters) {
      Object.entries(parameters).forEach(([key, value]) => {
        definition = definition.replace(new RegExp(`{${key}}`, 'g'), String(value));
      });
    }

    return definition;
  }

  /**
   * Deletes a test case by ID.
   *
   * This method removes a test case from the database and updates
   * the corresponding feature file to remove the scenario.
   *
   * @param testCaseId - The ID of the test case to delete
   * @returns Promise that resolves when the test case is deleted
   * @throws Error when test case is not found or deletion fails
   *
   * @example
   * ```typescript
   * await service.deleteTestCase('TC-ECOMMERCE-01');
   * ```
   */
  async deleteTestCase(testCaseId: string): Promise<void> {
    this.logger.log(`Deleting test case: ${testCaseId}`);

    try {
      const testCase = await this.findTestCaseEntityById(testCaseId);

      // 1. Remove from database
      await this.testCaseRepository.remove(testCase);

      // 2. Update feature files
      try {
        await this.featureFileManagerService.removeTestCaseFromFeature(
          testCase.projectId,
          testCase.section,
          testCase.entityName,
          testCase
        );
        this.logger.log(`Test case removed from feature file: ${testCaseId}`);
      } catch (featureError) {
        this.logger.warn(`Warning: Could not remove test case from feature file: ${featureError.message}`);
        // Don't throw error here, just log as warning
      }

      this.logger.log(`Test case deleted successfully: ${testCaseId}`);
    } catch (error) {
      this.logger.error('Error deleting test case:', error);
      throw error;
    }
  }

  /**
   * Finds a test case by its ID and returns it as a response DTO.
   *
   * This method retrieves a test case from the database by its ID
   * and converts it to a response DTO format.
   *
   * @param testCaseId - The ID of the test case to find
   * @returns Promise resolving to the test case response DTO
   * @throws Error when test case is not found
   *
   * @example
   * ```typescript
   * const testCase = await service.findByTestCaseId('TC-ECOMMERCE-01');
   * ```
   */
  async findByTestCaseId(testCaseId: string): Promise<TestCaseResponseDto> {
    const testCase = await this.findTestCaseEntityById(testCaseId);
    return this.toTestCaseResponseDto(testCase);
  }

  /**
   * Lists test cases for a project with filtering and pagination.
   *
   * This method retrieves test cases for a specific project with support for
   * filtering by various criteria and pagination. It applies filters for
   * entity name, section, method, test type, status, search terms, and tags.
   *
   * @param projectId - The ID of the project to list test cases for
   * @param filters - Filtering and pagination criteria
   * @returns Promise resolving to paginated list of test cases with metadata
   * @throws Error when database operations fail
   *
   * @example
   * ```typescript
   * const result = await service.listTestCases('project-123', {
   *   page: 1,
   *   limit: 20,
   *   entityName: 'Product',
   *   method: 'POST',
   *   search: 'create'
   * });
   * ```
   */
  async listTestCases(projectId: string, filters: TestCaseFiltersDto): Promise<TestCaseListResponseDto> {
    this.logger.log(`Listing test cases for project ${projectId}`);

    try {

      const queryBuilder = this.testCaseRepository
        .createQueryBuilder('testCase')
        .where('testCase.projectId = :projectId', { projectId });


      if (filters.entityName) {
        queryBuilder.andWhere('testCase.entityName = :entityName', { entityName: filters.entityName });
      }

      if (filters.section) {
        queryBuilder.andWhere('testCase.section = :section', { section: filters.section });
      }

      if (filters.method) {
        queryBuilder.andWhere('testCase.method = :method', { method: filters.method });
      }

      if (filters.testType) {
        queryBuilder.andWhere('testCase.testType = :testType', { testType: filters.testType });
      }

      if (filters.status) {
        queryBuilder.andWhere('testCase.status = :status', { status: filters.status });
      }

      if (filters.search) {
        queryBuilder.andWhere(
          '(testCase.name LIKE :search OR testCase.description LIKE :search)',
          { search: `%${filters.search}%` }
        );
      }

      if (filters.tags && filters.tags.length > 0) {
 
        const tagConditions = filters.tags.map((_, index) => `testCase.tags LIKE :tag${index}`);
        queryBuilder.andWhere(`(${tagConditions.join(' OR ')})`);
        filters.tags.forEach((tag, index) => {
          queryBuilder.setParameter(`tag${index}`, `%${tag}%`);
        });
      }


      const sortBy = filters.sortBy || 'createdAt';
      const sortOrder = filters.sortOrder || 'DESC';
      queryBuilder.orderBy(`testCase.${sortBy}`, sortOrder as 'ASC' | 'DESC');

      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const offset = (page - 1) * limit;

      queryBuilder.skip(offset).take(limit);

      const [testCases, total] = await queryBuilder.getManyAndCount();

      const totalPages = Math.ceil(total / limit);

      this.logger.log(`Found ${testCases.length} test cases (total: ${total})`);

      return {
        testCases: testCases.map(testCase => this.toTestCaseResponseDto(testCase)),
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
        filters,
      };
    } catch (error) {
      this.logger.error('Error listing test cases:', error);
      throw error;
    }
  }

  /**
   * Lists all test cases across all projects.
   *
   * This method retrieves all test cases from the database regardless of project,
   * ordered by creation date in descending order.
   *
   * @returns Promise resolving to array of all test case entities
   * @throws Error when database operations fail
   *
   * @example
   * ```typescript
   * const allTestCases = await service.listAllTestCases();
   * ```
   */
  async listAllTestCases(): Promise<TestCase[]> {
    this.logger.log('Listing all test cases across all projects');

    try {
      const testCases = await this.testCaseRepository.find({
        order: { createdAt: 'DESC' },
      });

      this.logger.log(`Found ${testCases.length} test cases globally`);
      return testCases;
    } catch (error) {
      this.logger.error('Error listing all test cases:', error);
      throw error;
    }
  }

  /**
   * Deletes all test cases for a specific project, section, and entity combination.
   *
   * This method removes all test cases that match the specified project ID,
   * section, and entity name from the database.
   *
   * @param projectId - The ID of the project
   * @param section - The section/category name
   * @param entityName - The entity name
   * @returns Promise that resolves when all matching test cases are deleted
   * @throws Error when database operations fail
   *
   * @example
   * ```typescript
   * await service.deleteTestCasesByProjectSectionEntity('project-123', 'ecommerce', 'Product');
   * ```
   */
  async deleteTestCasesByProjectSectionEntity(projectId: string, section: string, entityName: string): Promise<void> {
    this.logger.log(`Deleting all test cases for projectId=${projectId}, section=${section}, entityName=${entityName}`);
    try {
      await this.testCaseRepository.delete({ projectId, section, entityName });
      this.logger.log(`All test cases deleted for projectId=${projectId}, section=${section}, entityName=${entityName}`);
    } catch (error) {
      this.logger.error('Error deleting test cases by project/section/entity:', error);
      throw error;
    }
  }

  /**
   * Gets test case statistics for a project.
   *
   * This method is currently a placeholder for future AI implementation.
   * It will provide comprehensive statistics about test cases in a project.
   *
   * @param projectId - The ID of the project to get statistics for
   * @returns Promise resolving to test case statistics
   * @throws Error indicating this is a TODO implementation
   *
   * @example
   * ```typescript
   * const stats = await service.getStatistics('project-123');
   * ```
   */
  async getStatistics(projectId: string): Promise<TestCaseStatisticsDto> {
    throw new Error('TODO: Implement with AI - getStatistics');
  }


  private async findTestCaseEntityById(testCaseId: string): Promise<TestCase> {
    const testCase = await this.testCaseRepository.findOne({
      where: { testCaseId },
    });

    if (!testCase) {
      this.logger.error(`Test case not found in database: ${testCaseId}`);
      throw new Error(`Test case not found: ${testCaseId}`);
    }

    return testCase;
  }

  private async generateTestCaseId(projectId: string, section: string, entityName: string): Promise<string> {
    // Pattern: @TC-{section}-{entity}-{NN} (section/entity case-sensitive per file examples)
    const patternDb = `TC-${section}-${entityName}-`;
    const testCases = await this.testCaseRepository
      .createQueryBuilder('testCase')
      .where('testCase.projectId = :projectId', { projectId })
      .andWhere('testCase.testCaseId LIKE :pattern', { pattern: `${patternDb}%` })
      .getMany();

    let maxDb = 0;
    for (const tc of testCases) {
      const match = tc.testCaseId.match(new RegExp(`^TC-${section}-${entityName}-(\\d+)$`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxDb) maxDb = num;
      }
    }

    // Read from feature file as well
    let maxFile = 0;
    try {
      maxFile = await this.featureFileManagerService.getMaxNumberFromFeature(projectId, section, entityName);
    } catch {}

    const next = Math.max(maxDb, maxFile) + 1;
    return `TC-${section}-${entityName}-${String(next).padStart(2, '0')}`;
  }

  private async validateTestCase(dto: CreateTestCaseDto | (TestCase & UpdateTestCaseDto)): Promise<void> {
    // Basic validations
    if (!dto.name || dto.name.trim().length === 0) {
      throw new Error('Test case name is required');
    }

    if (!dto.description || dto.description.trim().length === 0) {
      throw new Error('Test case description is required');
    }

    if (!dto.entityName || dto.entityName.trim().length === 0) {
      throw new Error('Entity name is required');
    }

    if (!dto.section || dto.section.trim().length === 0) {
      throw new Error('Section is required');
    }

    if (!dto.method || dto.method.trim().length === 0) {
      throw new Error('Method is required');
    }

    if (!dto.tags || dto.tags.length === 0) {
      throw new Error('At least one tag is required');
    }

    if (!dto.scenario || dto.scenario.trim().length === 0) {
      throw new Error('Scenario content is required');
    }
  }

  public toTestCaseResponseDto(testCase: TestCase): TestCaseResponseDto {
    return {
      id: testCase.id,
      testCaseId: testCase.testCaseId,
      projectId: testCase.projectId,
      entityName: testCase.entityName,
      section: testCase.section,
      name: testCase.name,
      description: testCase.description,
      tags: testCase.tags,
      method: testCase.method,
      testType: testCase.testType,
      scenario: testCase.scenario,
      hooks: testCase.hooks,
      examples: testCase.examples,
      status: testCase.status,
      lastRun: testCase.lastRun,
      lastRunStatus: testCase.lastRunStatus,
      metadata: testCase.metadata,
      createdAt: testCase.createdAt,
      updatedAt: testCase.updatedAt,
    };
  }
} 