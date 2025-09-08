import { Injectable, Logger, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { TestSuite, TestSuiteType, TestSuiteStatus, ExecutionStatus } from '../entities/test-suite.entity';
import { CreateTestSuiteDto } from '../dto/create-test-suite.dto';
import { UpdateTestSuiteDto } from '../dto/update-test-suite.dto';
import { TestSuiteFiltersDto } from '../dto/test-suite-filters.dto';
import { TestSuiteResponseDto } from '../dto/test-suite-response.dto';
import { Project } from '../../projects/project.entity';
import { TestCase } from '../../test-cases/entities/test-case.entity';
import { TestExecutionService } from '../../test-execution/services/test-execution.service';
import { TestType, TestEnvironment } from '../../test-execution/dto/execute-tests.dto';
import { ExecuteTestSuiteDto } from '../dto/execute-test-suite.dto';

@Injectable()
/**
 * Service: TestSuitesService
 *
 * Manages creation, retrieval, update, deletion and execution of test suites
 * (test sets and test plans), including statistics updates and integration
 * with the TestExecutionService.
 */
export class TestSuitesService {
  private readonly logger = new Logger(TestSuitesService.name);

  constructor(
    @InjectRepository(TestSuite)
    private readonly testSuiteRepository: Repository<TestSuite>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(TestCase)
    private readonly testCaseRepository: Repository<TestCase>,
    @Inject(forwardRef(() => TestExecutionService))
    private readonly testExecutionService: TestExecutionService,
  ) {}

  /**
   * Creates a test suite (test set or test plan) for a given project.
   * 
   * @param projectId - The ID of the project to create the test suite for
   * @param dto - The test suite creation data
   * @returns Promise<TestSuiteResponseDto> - The created test suite response
   * @throws NotFoundException - If the project is not found
   * @throws BadRequestException - If validation fails
   * 
   * @example
   * ```typescript
   * const testSuite = await testSuitesService.createTestSuite('project-123', {
   *   name: 'Product API Tests',
   *   type: TestSuiteType.TEST_SET,
   *   section: 'ecommerce',
   *   entity: 'Product',
   *   testCaseIds: ['TC-001', 'TC-002']
   * });
   * ```
   */
  async createTestSuite(projectId: string, dto: CreateTestSuiteDto): Promise<TestSuiteResponseDto> {
    this.logger.log(`Creating test suite for project: ${projectId}`);

    // Verify project exists
    const project = await this.projectRepository.findOne({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    // Generate suite ID
    const suiteId = await this.generateSuiteId(project.name, dto.type, dto.section || '', dto.type === TestSuiteType.TEST_SET ? dto.entity : undefined);

    // Get test cases if provided
    let testCases: Array<{
      testCaseId: string;
      name: string;
      entityName: string;
      section: string;
    }> = [];
    if (dto.testCaseIds && dto.testCaseIds.length > 0) {
      const foundTestCases = await this.testCaseRepository.find({
        where: { testCaseId: In(dto.testCaseIds), projectId }
      });
      
      testCases = foundTestCases.map(tc => ({
        testCaseId: tc.testCaseId,
        name: tc.name,
        entityName: tc.entityName,
        section: tc.section
      }));
    }

    // Get test suites if provided (for test plans)
    let testSets: Array<{
      setId: string;
      name: string;
      testCases: string[];
    }> = [];
    let totalTestCasesForPlan = 0;
    
    if (dto.testSuiteIds && dto.testSuiteIds.length > 0 && dto.type === TestSuiteType.TEST_PLAN) {
      this.logger.log(`Creating test plan with test suite IDs: ${dto.testSuiteIds.join(', ')}`);
      
      const foundTestSuites = await this.testSuiteRepository.find({
        where: { suiteId: In(dto.testSuiteIds), projectId, type: TestSuiteType.TEST_SET }
      });
      
      this.logger.log(`Found ${foundTestSuites.length} test suites for test plan`);
      
      testSets = foundTestSuites.map(ts => ({
        setId: ts.suiteId,
        name: ts.name,
        testCases: ts.testCases?.map(tc => tc.testCaseId) || []
      }));
      
      // Calculate total test cases for the plan
      totalTestCasesForPlan = foundTestSuites.reduce((total, ts) => total + (ts.totalTestCases || 0), 0);
      
      this.logger.log(`Test plan will contain ${testSets.length} test sets with ${totalTestCasesForPlan} total test cases`);
    }

    this.logger.log(`Creating test suite with ${testCases.length} test cases: ${testCases.map(tc => tc.name).join(', ')}`);

    const testSuite = this.testSuiteRepository.create({
      projectId,
      suiteId,
      name: dto.name,
      description: dto.description || '',
      type: dto.type,
      status: TestSuiteStatus.PENDING,
      section: dto.section || '',
      entity: dto.entity || '',
      tags: dto.tags || [],
      testCases,
      testSets,
      totalTestCases: dto.type === TestSuiteType.TEST_PLAN ? totalTestCasesForPlan : testCases.length,
      environment: 'default'
    });

    const savedTestSuite = await this.testSuiteRepository.save(testSuite);
    this.logger.log(`Test suite ${suiteId} created successfully with ${savedTestSuite.totalTestCases} test cases`);
    
    if (dto.type === TestSuiteType.TEST_PLAN) {
      this.logger.log(`Test plan ${suiteId} saved with ${savedTestSuite.testSets?.length || 0} test sets`);
      this.logger.log(`Test plan testSets: ${JSON.stringify(savedTestSuite.testSets)}`);
    }
    
    return this.mapToResponseDto(savedTestSuite);
  }

  /**
   * Retrieves test suites for a project with filtering, sorting, and pagination.
   * 
   * @param projectId - The ID of the project to get test suites for
   * @param filters - Filtering, sorting, and pagination options
   * @returns Promise<object> - Paginated list of test suites with metadata
   * 
   * @example
   * ```typescript
   * const result = await testSuitesService.getTestSuites('project-123', {
   *   type: TestSuiteType.TEST_SET,
   *   section: 'ecommerce',
   *   page: 1,
   *   limit: 10
   * });
   * ```
   */
  async getTestSuites(projectId: string, filters: TestSuiteFiltersDto): Promise<{
    testSuites: TestSuiteResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    this.logger.log(`Getting test suites for project: ${projectId}`);

    const queryBuilder = this.testSuiteRepository.createQueryBuilder('ts')
      .where('ts.projectId = :projectId', { projectId });

    // Apply filters
    if (filters.type) {
      queryBuilder.andWhere('ts.type = :type', { type: filters.type });
    }

    if (filters.status) {
      queryBuilder.andWhere('ts.status = :status', { status: filters.status });
    }

    if (filters.section) {
      queryBuilder.andWhere('ts.section = :section', { section: filters.section });
    }

    if (filters.entity) {
      queryBuilder.andWhere('ts.entity = :entity', { entity: filters.entity });
    }

    if (filters.tags && filters.tags.length > 0) {
      queryBuilder.andWhere('ts.tags && :tags', { tags: filters.tags });
    }

    if (filters.environment) {
      queryBuilder.andWhere('ts.environment = :environment', { environment: filters.environment });
    }

    if (filters.search) {
      queryBuilder.andWhere(
        '(ts.name LIKE :search OR ts.description LIKE :search)',
        { search: `%${filters.search}%` }
      );
    }

    // Apply sorting
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'DESC';
    queryBuilder.orderBy(`ts.${sortBy}`, sortOrder);

    // Apply pagination
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const offset = (page - 1) * limit;

    queryBuilder.skip(offset).take(limit);

    const [testSuites, total] = await queryBuilder.getManyAndCount();

    return {
      testSuites: testSuites.map(ts => this.mapToResponseDto(ts)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Retrieves a specific test suite by ID.
   * 
   * @param projectId - The ID of the project
   * @param suiteId - The ID of the test suite to retrieve
   * @returns Promise<TestSuiteResponseDto> - The test suite response
   * @throws NotFoundException - If the test suite is not found
   * 
   * @example
   * ```typescript
   * const testSuite = await testSuitesService.getTestSuite('project-123', 'SUITE-ECOMMERCE-PRODUCT-001');
   * ```
   */
  async getTestSuite(projectId: string, suiteId: string): Promise<TestSuiteResponseDto> {
    this.logger.log(`Getting test suite: ${suiteId} for project: ${projectId}`);

    const testSuite = await this.testSuiteRepository.findOne({
      where: { projectId, suiteId }
    });

    if (!testSuite) {
      throw new NotFoundException(`Test suite with ID ${suiteId} not found`);
    }

    return this.mapToResponseDto(testSuite);
  }

  /**
   * Updates an existing test suite.
   * 
   * @param projectId - The ID of the project
   * @param suiteId - The ID of the test suite to update
   * @param dto - The update data for the test suite
   * @returns Promise<TestSuiteResponseDto> - The updated test suite response
   * @throws NotFoundException - If the test suite is not found
   * 
   * @example
   * ```typescript
   * const updatedSuite = await testSuitesService.updateTestSuite('project-123', 'SUITE-001', {
   *   name: 'Updated Test Suite',
   *   testCaseIds: ['TC-001', 'TC-002', 'TC-003']
   * });
   * ```
   */
  async updateTestSuite(projectId: string, suiteId: string, dto: UpdateTestSuiteDto): Promise<TestSuiteResponseDto> {
    this.logger.log(`Updating test suite: ${suiteId} for project: ${projectId}`);

    const testSuite = await this.testSuiteRepository.findOne({
      where: { projectId, suiteId }
    });

    if (!testSuite) {
      throw new NotFoundException(`Test suite with ID ${suiteId} not found`);
    }

    // Update basic fields
    if (dto.name !== undefined) testSuite.name = dto.name;
    if (dto.description !== undefined) testSuite.description = dto.description;
    if (dto.type !== undefined) testSuite.type = dto.type;
    if (dto.status !== undefined) testSuite.status = dto.status;
    if (dto.tags !== undefined) testSuite.tags = dto.tags;

    // Update test cases if provided
    if (dto.testCaseIds !== undefined) {
      const foundTestCases = await this.testCaseRepository.find({
        where: { testCaseId: In(dto.testCaseIds), projectId }
      });
      
      testSuite.testCases = foundTestCases.map(tc => ({
        testCaseId: tc.testCaseId,
        name: tc.name,
        entityName: tc.entityName,
        section: tc.section
      }));
      testSuite.totalTestCases = testSuite.testCases.length;
      
      this.logger.log(`Updated test suite ${suiteId} with ${testSuite.totalTestCases} test cases: ${testSuite.testCases.map(tc => tc.name).join(', ')}`);
    }

    // Update test sets if provided (for test plans)
    if (dto.testSuiteIds !== undefined && testSuite.type === TestSuiteType.TEST_PLAN) {
      const foundTestSuites = await this.testSuiteRepository.find({
        where: { suiteId: In(dto.testSuiteIds), projectId, type: TestSuiteType.TEST_SET }
      });
      
      testSuite.testSets = foundTestSuites.map(ts => ({
        setId: ts.suiteId,
        name: ts.name,
        testCases: ts.testCases?.map(tc => tc.testCaseId) || []
      }));
      
      // Update totalTestCases for test plans
      testSuite.totalTestCases = foundTestSuites.reduce((total, ts) => total + (ts.totalTestCases || 0), 0);
      this.logger.log(`Updated test plan ${suiteId} with ${testSuite.totalTestCases} total test cases from ${foundTestSuites.length} test sets`);
    }

    const updatedTestSuite = await this.testSuiteRepository.save(testSuite);
    return this.mapToResponseDto(updatedTestSuite);
  }

  /**
   * Deletes a test suite.
   * 
   * @param projectId - The ID of the project
   * @param suiteId - The ID of the test suite to delete
   * @returns Promise<object> - Success status and message
   * @throws NotFoundException - If the test suite is not found
   * 
   * @example
   * ```typescript
   * const result = await testSuitesService.deleteTestSuite('project-123', 'SUITE-001');
   * // Returns: { success: true, message: 'Test suite SUITE-001 deleted successfully' }
   * ```
   */
  async deleteTestSuite(projectId: string, suiteId: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Deleting test suite: ${suiteId} for project: ${projectId}`);

    const testSuite = await this.testSuiteRepository.findOne({
      where: { projectId, suiteId }
    });

    if (!testSuite) {
      throw new NotFoundException(`Test suite with ID ${suiteId} not found`);
    }

    await this.testSuiteRepository.remove(testSuite);

    return {
      success: true,
      message: `Test suite ${suiteId} deleted successfully`
    };
  }

  /**
   * Executes a test suite (test set or test plan).
   * 
   * @param projectId - The ID of the project
   * @param suiteId - The ID of the test suite to execute
   * @param dto - Optional execution configuration parameters
   * @returns Promise<object> - Execution result with status and metadata
   * @throws NotFoundException - If the test suite is not found
   * @throws BadRequestException - If the test suite has no test cases or test sets to execute
   * 
   * @example
   * ```typescript
   * const result = await testSuitesService.executeTestSuite('project-123', 'SUITE-001', {
   *   parallel: true,
   *   timeout: 30000,
   *   environment: TestEnvironment.STAGING
   * });
   * ```
   */
  async executeTestSuite(projectId: string, suiteId: string, dto?: ExecuteTestSuiteDto): Promise<{
    success: boolean;
    data: {
      executionId: string;
      status: string;
      message: string;
      startedAt: string;
    };
  }> {
    this.logger.log(`Executing test suite: ${suiteId} for project: ${projectId}`);

    const testSuite = await this.testSuiteRepository.findOne({
      where: { projectId, suiteId }
    });

    if (!testSuite) {
      throw new NotFoundException(`Test suite with ID ${suiteId} not found`);
    }

    this.logger.log(`Test suite ${suiteId} details:`);
    this.logger.log(`  - Type: ${testSuite.type}`);
    this.logger.log(`  - Total test cases: ${testSuite.totalTestCases}`);
    
    if (testSuite.type === TestSuiteType.TEST_PLAN) {
      this.logger.log(`  - Test sets array: ${JSON.stringify(testSuite.testSets)}`);
      this.logger.log(`  - Test sets length: ${testSuite.testSets?.length || 0}`);
      
      // For Test Plans: verify that they have test sets
      const actualTestSetsCount = testSuite.testSets?.length || 0;
      
      if (actualTestSetsCount === 0) {
        this.logger.warn(`Test plan ${suiteId} has no test sets to execute. This might be due to:`);
        this.logger.warn(`  1. No test sets were selected during creation`);
        this.logger.warn(`  2. Test sets were not saved correctly`);
        this.logger.warn(`  3. Test sets were removed after creation`);
        
        throw new BadRequestException(`Test plan ${suiteId} has no test sets to execute. Please add test sets to this test plan before executing.`);
      }
    } else {
      this.logger.log(`  - Test cases array: ${JSON.stringify(testSuite.testCases)}`);
      this.logger.log(`  - Test cases length: ${testSuite.testCases?.length || 0}`);
      
      // For Test Sets: verify that they have test cases
      const actualTestCasesCount = testSuite.testCases?.length || 0;
      
      if (actualTestCasesCount === 0) {
        this.logger.warn(`Test set ${suiteId} has no test cases to execute. This might be due to:`);
        this.logger.warn(`  1. No test cases were selected during creation`);
        this.logger.warn(`  2. Test cases were not saved correctly`);
        this.logger.warn(`  3. Test cases were removed after creation`);
        
        throw new BadRequestException(`Test set ${suiteId} has no test cases to execute. Please add test cases to this test set before executing.`);
      }
      
      // Fix totalTestCases if inconsistent (only for test sets)
      if (testSuite.totalTestCases !== actualTestCasesCount) {
        this.logger.warn(`Fixing inconsistent totalTestCases: ${testSuite.totalTestCases} -> ${actualTestCasesCount}`);
        testSuite.totalTestCases = actualTestCasesCount;
        await this.testSuiteRepository.save(testSuite);
      }
    }

    // Update execution status and timestamps
    testSuite.status = TestSuiteStatus.RUNNING;
    testSuite.startedAt = new Date();
    testSuite.lastExecutedAt = new Date();
    await this.testSuiteRepository.save(testSuite);

    // Generate execution ID
    const executionId = `EXEC-${suiteId}-${Date.now()}`;

    // Save executionId in executionLogs field
    testSuite.executionLogs = executionId;
    await this.testSuiteRepository.save(testSuite);

    // Execute tests using TestExecutionService
    try {
      if (testSuite.type === TestSuiteType.TEST_PLAN) {
        // For Test Plans: execute all contained test sets
        return await this.executeTestPlan(projectId, testSuite, dto);
      } else {
        // For Test Sets: execute test cases directly
        return await this.executeTestSet(projectId, testSuite, dto);
      }
    } catch (error) {
      this.logger.error(`Error executing test suite ${suiteId}: ${error.message}`);
      
      // Revert status in case of error
      testSuite.status = TestSuiteStatus.FAILED;
      await this.testSuiteRepository.save(testSuite);
      
      throw error;
    }
  }

  /**
   * Retrieves execution history for a test suite.
   * 
   * @param projectId - The ID of the project
   * @param suiteId - The ID of the test suite
   * @returns Promise<any[]> - Array of execution history records
   * @throws NotFoundException - If the test suite is not found
   * 
   * @example
   * ```typescript
   * const history = await testSuitesService.getExecutionHistory('project-123', 'SUITE-001');
   * ```
   */
  async getExecutionHistory(projectId: string, suiteId: string): Promise<any[]> {
    this.logger.log(`Getting execution history for test suite: ${suiteId}`);

    const testSuite = await this.testSuiteRepository.findOne({
      where: { projectId, suiteId }
    });

    if (!testSuite) {
      throw new NotFoundException(`Test suite with ID ${suiteId} not found`);
    }

    // If an executionId is stored in executionLogs, obtain results
    if (testSuite!.executionLogs) {
      try {
        // TODO: Integrate with TestExecutionService to get real results. For now, basic info is returned
        return [{
          executionId: testSuite!.executionLogs,
          status: testSuite!.status,
          startedAt: testSuite!.startedAt,
          completedAt: testSuite!.completedAt,
          totalScenarios: testSuite!.totalTestCases,
          passedScenarios: testSuite!.passedTestCases,
          failedScenarios: testSuite!.failedTestCases,
          successRate: testSuite!.totalTestCases > 0 
            ? (testSuite!.passedTestCases / testSuite!.totalTestCases) * 100 
            : 0,
        }];
      } catch (error) {
        this.logger.warn(`Error getting execution results: ${error.message}`);
      }
    }

    return [];
  }

  /**
   * Retrieves all test sets for a specific section.
   * 
   * @param projectId - The ID of the project
   * @param section - The section name to filter by
   * @returns Promise<TestSuiteResponseDto[]> - Array of test sets for the section
   * 
   * @example
   * ```typescript
   * const testSets = await testSuitesService.getTestSetsBySection('project-123', 'ecommerce');
   * ```
   */
  async getTestSetsBySection(projectId: string, section: string): Promise<TestSuiteResponseDto[]> {
    this.logger.log(`Getting test sets for section: ${section} in project: ${projectId}`);

    const testSets = await this.testSuiteRepository.find({
      where: { 
        projectId, 
        section, 
        type: TestSuiteType.TEST_SET 
      },
      order: { createdAt: 'DESC' }
    });

    return testSets.map(ts => this.mapToResponseDto(ts));
  }

  /**
   * Executes a Test Set (collection of test cases).
   * 
   * @param projectId - The ID of the project
   * @param testSuite - The test suite entity to execute
   * @param dto - Optional execution configuration parameters
   * @returns Promise<object> - Execution result with status and metadata
   * @private
   */
  private async executeTestSet(
    projectId: string, 
    testSuite: TestSuite, 
    dto?: ExecuteTestSuiteDto
  ): Promise<{
    success: boolean;
    data: {
      executionId: string;
      status: string;
      message: string;
      startedAt: string;
    };
  }> {
    // Extract specific scenario names from test set
    const specificScenarios = testSuite.testCases?.map(tc => tc.name) || [];
    
    this.logger.log(`Test set ${testSuite.suiteId} contains ${specificScenarios.length} specific scenarios: ${specificScenarios.join(', ')}`);
    
    // Prepare execution DTO
    const executeTestsDto = {
      entityName: testSuite.entity,
      method: dto?.method,
      testType: dto?.testType || TestType.ALL,
      tags: testSuite.tags,
      specificScenario: specificScenarios.length > 0 ? specificScenarios.join(',') : undefined,
      environment: dto?.environment || testSuite.environment as TestEnvironment || TestEnvironment.LOCAL,
      verbose: dto?.verbose ?? true,
      saveLogs: dto?.saveLogs ?? true,
      savePayloads: dto?.savePayloads ?? true,
      parallel: dto?.parallel ?? true,
      timeout: dto?.timeout || 30000,
      retries: dto?.retries || 1,
      workers: dto?.workers || 3,
      testSuiteId: testSuite.suiteId,
    };

    // Call TestExecutionService
    const executionResult = await this.testExecutionService.executeTests(projectId, executeTestsDto);

    this.logger.log(`Test set ${testSuite.suiteId} execution initiated with execution ID: ${executionResult.executionId}`);

    // Wait briefly so that execution can progress and stats update
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verify the test set got updated
    const updatedTestSet = await this.testSuiteRepository.findOne({
      where: { projectId, suiteId: testSuite.suiteId }
    });

    if (updatedTestSet && updatedTestSet.status !== TestSuiteStatus.RUNNING) {
      this.logger.log(`Test set ${testSuite.suiteId} execution completed with status: ${updatedTestSet.status}`);
    } else {
      this.logger.warn(`Test set ${testSuite.suiteId} still in RUNNING status, may need more time to complete`);
    }

    return {
      success: true,
      data: {
        executionId: executionResult.executionId,
        status: 'started',
        message: `Test set execution completed successfully with ${testSuite.totalTestCases} test cases`,
        startedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Executes a Test Plan (collection of test sets).
   * 
   * @param projectId - The ID of the project
   * @param testPlan - The test plan entity to execute
   * @param dto - Optional execution configuration parameters
   * @returns Promise<object> - Execution result with status and metadata
   * @private
   */
  private async executeTestPlan(
    projectId: string, 
    testPlan: TestSuite, 
    dto?: ExecuteTestSuiteDto
  ): Promise<{
    success: boolean;
    data: {
      executionId: string;
      status: string;
      message: string;
      startedAt: string;
    };
  }> {
    this.logger.log(`Executing test plan ${testPlan.suiteId} with ${testPlan.testSets?.length || 0} test sets`);
    this.logger.log(`Test plan testSets: ${JSON.stringify(testPlan.testSets)}`);
    
    // Get all test sets of the plan
    const testSetIds = testPlan.testSets?.map(ts => ts.setId) || [];
    this.logger.log(`Test set IDs to execute: ${testSetIds.join(', ')}`);
    
    if (testSetIds.length === 0) {
      throw new BadRequestException(`Test plan ${testPlan.suiteId} has no test sets to execute`);
    }

    // Retrieve full test sets from the database
    this.logger.log(`Searching for test sets with IDs: ${testSetIds.join(', ')}`);
    const testSets = await this.testSuiteRepository.find({
      where: { suiteId: In(testSetIds), projectId, type: TestSuiteType.TEST_SET }
    });

    this.logger.log(`Found ${testSets.length} test sets in database: ${testSets.map(ts => ts.suiteId).join(', ')}`);

    if (testSets.length === 0) {
      throw new BadRequestException(`No test sets found for test plan ${testPlan.suiteId}`);
    }

    this.logger.log(`Found ${testSets.length} test sets to execute: ${testSets.map(ts => ts.suiteId).join(', ')}`);

    // Create a test execution for the entire test plan BEFORE executing test sets
    const planExecutionDto = {
      entityName: testPlan.entity,
      method: dto?.method,
      testType: dto?.testType || TestType.ALL,
      tags: testPlan.tags,
      environment: dto?.environment || testPlan.environment as TestEnvironment || TestEnvironment.LOCAL,
      verbose: dto?.verbose ?? true,
      saveLogs: dto?.saveLogs ?? true,
      savePayloads: dto?.savePayloads ?? true,
      parallel: dto?.parallel ?? true,
      timeout: dto?.timeout || 30000,
      retries: dto?.retries || 1,
      workers: dto?.workers || 3,
      testSuiteId: testPlan.suiteId, // Use the test plan ID
    };

    // Create the test execution for the test plan
    const planExecutionResult = await this.testExecutionService.executeTests(projectId, planExecutionDto);
    this.logger.log(`Created test execution for test plan ${testPlan.suiteId} with ID: ${planExecutionResult.executionId}`);

    // DO NOT execute individual test sets - only collect info for statistics
    const executionResults: Array<{
      testSetId: string;
      testSetName: string;
      testCases: string[];
      totalTestCases: number;
    }> = [];
    let totalTestCases = 0;

    for (const testSet of testSets) {
      // Only collect information, DO NOT execute
      const testCaseIds = testSet.testCases?.map(tc => tc.testCaseId) || [];
      const testSetTotalTestCases = testCaseIds.length;
      
      executionResults.push({
        testSetId: testSet.suiteId,
        testSetName: testSet.name,
        testCases: testCaseIds,
        totalTestCases: testSetTotalTestCases
      });
      
      totalTestCases += testSetTotalTestCases;
      this.logger.log(`Test set ${testSet.suiteId} has ${testSetTotalTestCases} test cases: ${testCaseIds.join(', ')}`);
    }

    // Update test plan statistics
    testPlan.totalTestCases = totalTestCases;
    testPlan.passedTestCases = 0; // Will be updated when the real execution completes
    testPlan.failedTestCases = 0; // Will be updated when the real execution completes
    testPlan.skippedTestCases = 0; // Will be updated when the real execution completes
    testPlan.executionTime = 0; // Will be updated when the real execution completes
    testPlan.completedAt = new Date();
    
    // Keep status as RUNNING until the real execution completes
    testPlan.status = TestSuiteStatus.RUNNING;

    // Save execution results in the test plan
    testPlan.executionLogs = JSON.stringify({
      planExecutionId: `PLAN-EXEC-${testPlan.suiteId}-${Date.now()}`,
      testSetResults: executionResults,
      totalTestCases,
      startedAt: new Date().toISOString(),
      completedAt: testPlan.completedAt.toISOString()
    });
    
    await this.testSuiteRepository.save(testPlan);

    this.logger.log(`Test plan ${testPlan.suiteId} execution initiated:`);
    this.logger.log(`  - Total test cases: ${totalTestCases}`);
    this.logger.log(`  - Test sets: ${testSets.length}`);
    this.logger.log(`  - Plan execution ID: ${planExecutionResult.executionId}`);

    return {
      success: true,
      data: {
        executionId: planExecutionResult.executionId,
        status: 'started',
        message: `Test plan execution initiated with ${testSets.length} test sets and ${totalTestCases} total test cases`,
        startedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Updates test suite statistics based on execution results.
   * 
   * @param projectId - The ID of the project
   * @param suiteId - The ID of the test suite
   * @param executionResults - The execution results to update statistics with
   * @returns Promise<void>
   * @throws NotFoundException - If the test suite is not found
   * 
   * @example
   * ```typescript
   * await testSuitesService.updateTestSuiteExecutionStats('project-123', 'SUITE-001', {
   *   totalScenarios: 10,
   *   passedScenarios: 8,
   *   failedScenarios: 1,
   *   executionTime: 45000
   * });
   * ```
   */
  async updateTestSuiteExecutionStats(
    projectId: string, 
    suiteId: string, 
    executionResults: {
      totalScenarios: number;
      passedScenarios: number;
      failedScenarios: number;
      executionTime: number;
    }
  ): Promise<void> {
    this.logger.log(`Updating execution stats for test suite: ${suiteId}`);

    const testSuite = await this.testSuiteRepository.findOne({
      where: { projectId, suiteId }
    });

    if (!testSuite) {
      throw new NotFoundException(`Test suite with ID ${suiteId} not found`);
    }

    // Update statistics
    testSuite.totalTestCases = executionResults.totalScenarios;
    testSuite.passedTestCases = executionResults.passedScenarios;
    testSuite.failedTestCases = executionResults.failedScenarios;
    // Calculate skipped: total - passed - failed
    testSuite.skippedTestCases = executionResults.totalScenarios - executionResults.passedScenarios - executionResults.failedScenarios;
    testSuite.executionTime = executionResults.executionTime;
    testSuite.completedAt = new Date();
    
    // Determine final status
    if (executionResults.failedScenarios > 0) {
      testSuite.status = TestSuiteStatus.FAILED;
    } else if (executionResults.passedScenarios > 0) {
      testSuite.status = TestSuiteStatus.PASSED;
    } else {
      testSuite.status = TestSuiteStatus.SKIPPED;
    }

    await this.testSuiteRepository.save(testSuite);
    
    // Detailed log of updated statistics
    this.logger.log(`Test suite ${suiteId} execution stats updated successfully:`);
    this.logger.log(`  - Total scenarios: ${testSuite.totalTestCases}`);
    this.logger.log(`  - Passed scenarios: ${testSuite.passedTestCases}`);
    this.logger.log(`  - Failed scenarios: ${testSuite.failedTestCases}`);
    this.logger.log(`  - Skipped scenarios: ${testSuite.skippedTestCases}`);
    this.logger.log(`  - Final status: ${testSuite.status}`);
    this.logger.log(`  - Execution time: ${testSuite.executionTime}ms`);
  }

  /**
   * Generates a unique suite ID based on project name, type, section, and entity.
   * 
   * @param projectName - The name of the project
   * @param type - The type of test suite (TEST_SET or TEST_PLAN)
   * @param section - The section name
   * @param entity - Optional entity name (for test sets)
   * @returns Promise<string> - The generated suite ID
   * @private
   */
  private async generateSuiteId(projectName: string, type: TestSuiteType, section: string, entity?: string): Promise<string> {
    const prefix = type === TestSuiteType.TEST_SET ? 'SUITE' : 'PLAN';
    
    if (type === TestSuiteType.TEST_SET) {
      // For Test Sets: SUITE-section-entity-number
      const lastTestSuite = await this.testSuiteRepository
        .createQueryBuilder('ts')
        .where('ts.section = :section', { section })
        .andWhere('ts.entity = :entity', { entity })
        .andWhere('ts.type = :type', { type: TestSuiteType.TEST_SET })
        .orderBy('ts.suiteId', 'DESC')
        .getOne();

      let nextId = 1;
      if (lastTestSuite) {
        const match = lastTestSuite.suiteId.match(/-(\d+)$/);
        if (match) {
          nextId = parseInt(match[1]) + 1;
        }
      }

      return `${prefix}-${section.toUpperCase()}-${entity?.toUpperCase()}-${nextId.toString().padStart(3, '0')}`;
    } else {
      // For Test Plans: PLAN-section-number
      const lastTestPlan = await this.testSuiteRepository
        .createQueryBuilder('ts')
        .where('ts.section = :section', { section })
        .andWhere('ts.type = :type', { type: TestSuiteType.TEST_PLAN })
        .orderBy('ts.suiteId', 'DESC')
        .getOne();

      let nextId = 1;
      if (lastTestPlan) {
        const match = lastTestPlan.suiteId.match(/-(\d+)$/);
        if (match) {
          nextId = parseInt(match[1]) + 1;
        }
      }

      return `${prefix}-${section.toUpperCase()}-${nextId.toString().padStart(3, '0')}`;
    }
  }

  /**
   * Maps a TestSuite entity to a TestSuiteResponseDto.
   * 
   * @param testSuite - The test suite entity to map
   * @returns TestSuiteResponseDto - The mapped response DTO
   * @private
   */
  private mapToResponseDto(testSuite: TestSuite): TestSuiteResponseDto {
    return {
      id: testSuite.id,
      suiteId: testSuite.suiteId,
      projectId: testSuite.projectId,
      name: testSuite.name,
      description: testSuite.description,
      type: testSuite.type,
      status: testSuite.status,
      section: testSuite.section,
      entity: testSuite.entity,
      tags: testSuite.tags || [],
      testCases: testSuite.testCases || [],
      testSets: testSuite.testSets || [],
      totalTestCases: testSuite.totalTestCases || 0,
      passedTestCases: testSuite.passedTestCases || 0,
      failedTestCases: testSuite.failedTestCases || 0,
      skippedTestCases: testSuite.skippedTestCases || 0,
      executionTime: testSuite.executionTime || 0,
      lastExecutedAt: testSuite.lastExecutedAt,
      startedAt: testSuite.startedAt,
      completedAt: testSuite.completedAt,
      errors: testSuite.errors || [],
      bugs: testSuite.bugs || [],
      executionLogs: testSuite.executionLogs || '',
      environment: testSuite.environment || 'default',
      createdAt: testSuite.createdAt,
      updatedAt: testSuite.updatedAt
    };
  }
}
