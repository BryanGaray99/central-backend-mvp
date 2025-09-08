import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { Bug, BugType, BugSeverity, BugPriority, BugStatus } from '../entities/bug.entity';
import { CreateBugDto } from '../dto/create-bug.dto';
import { UpdateBugDto } from '../dto/update-bug.dto';
import { BugFiltersDto } from '../dto/bug-filters.dto';
import { BugResponseDto } from '../dto/bug-response.dto';
import { Project } from '../../projects/project.entity';
import { TestCase } from '../../test-cases/entities/test-case.entity';
import { TestSuite } from '../../test-suites/entities/test-suite.entity';
import { Endpoint } from '../../endpoints/endpoint.entity';

/**
 * Bugs Service
 * 
 * Comprehensive service for bug management and tracking functionality.
 * Handles bug creation, retrieval, updates, deletion, and automatic bug
 * generation from failed test executions. Provides statistics, filtering,
 * and integration with test execution results.
 * 
 * @service BugsService
 */
@Injectable()
export class BugsService {
  private readonly logger = new Logger(BugsService.name);

  constructor(
    @InjectRepository(Bug)
    private readonly bugRepository: Repository<Bug>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(TestCase)
    private readonly testCaseRepository: Repository<TestCase>,
    @InjectRepository(TestSuite)
    private readonly testSuiteRepository: Repository<TestSuite>,
    @InjectRepository(Endpoint)
    private readonly endpointRepository: Repository<Endpoint>,
  ) {}

  /**
   * Creates a new bug for a specific project.
   * 
   * @param projectId - The project ID
   * @param dto - The bug creation data
   * @returns Promise<BugResponseDto> - The created bug
   * @throws NotFoundException - If project, test case, or test suite not found
   * 
   * @example
   * ```typescript
   * const bug = await bugsService.createBug('project-123', {
   *   title: 'API returns 500 error',
   *   description: 'Product creation fails with internal server error',
   *   type: BugType.TEST_FAILURE,
   *   severity: BugSeverity.HIGH
   * });
   * ```
   */
  async createBug(projectId: string, dto: CreateBugDto): Promise<BugResponseDto> {
    this.logger.log(`Creating bug for project: ${projectId}`);

    // Verify project exists
    const project = await this.projectRepository.findOne({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    // Generate bug ID
    const bugId = await this.generateBugId(project.name, dto.section || '', dto.entity || '');

    // For automatic bug creation from execution results, we don't verify test case/suite existence
    // because the testCaseId might not exist in the test_cases table (it could be a generated ID)
    if (dto.testCaseId && !dto.executionId) {
      // Only verify for manual bug creation
      const testCase = await this.testCaseRepository.findOne({ 
        where: { testCaseId: dto.testCaseId, projectId } 
      });
      if (!testCase) {
        throw new NotFoundException(`Test case with ID ${dto.testCaseId} not found`);
      }
    }

    // For automatic bug creation, we don't verify test suite existence either
    if (dto.testSuiteId && !dto.executionId) {
      // Only verify for manual bug creation
      const testSuite = await this.testSuiteRepository.findOne({ 
        where: { suiteId: dto.testSuiteId, projectId } 
      });
      if (!testSuite) {
        throw new NotFoundException(`Test suite with ID ${dto.testSuiteId} not found`);
      }
    }

    // For automatic bug creation, we need to handle the foreign key constraints
    // Since we can't modify the database schema, we'll store the readable testCaseId
    // and handle foreign key relationships through additional queries when needed
    let finalTestCaseId: string | null = null; // Use null for foreign key when test case doesn't exist
    let finalTestSuiteId: string | null = null; // Use null for foreign key when test suite doesn't exist
    let finalTestCaseName = dto.testCaseName;
    let readableTestCaseId = dto.testCaseId; // Store the readable testCaseId
    let bugSection = dto.section;
    let bugEntity = dto.entity;
    let bugEndpoint = dto.endpoint || '';

    if (dto.executionId) {
      // For automatic creation, we'll store the readable testCaseId directly
      // and handle foreign key relationships through additional logic
      if (dto.testCaseId) {
        // Get the test case from database to get the UUID for foreign key
        const testCaseData = await this.getTestCaseDataFromDatabase(dto.testCaseId || '', projectId);
        if (testCaseData) {
          this.logger.log(`Found test case with ID ${dto.testCaseId}, using UUID: ${testCaseData.id}, name: ${testCaseData.name}, section: ${testCaseData.section}, entity: ${testCaseData.entity}, endpoint: ${testCaseData.endpointPath}`);
          finalTestCaseId = testCaseData.id; // Store the UUID for the foreign key
          finalTestCaseName = testCaseData.name; // Store the real test case name
          readableTestCaseId = dto.testCaseId; // Keep the readable ID for display purposes (stored in testCaseName)
          bugSection = testCaseData.section; // Update section from DB
          bugEntity = testCaseData.entity; // Update entity from DB
          bugEndpoint = testCaseData.endpointPath || ''; // Update endpoint from DB
        } else {
          this.logger.warn(`Test case with ID ${dto.testCaseId} not found in database, setting testCaseId to null`);
          finalTestCaseId = null; // Set to null to avoid foreign key constraint violation
          finalTestCaseName = dto.testCaseName || dto.scenarioName;
          readableTestCaseId = dto.testCaseId; // Keep the readable testCaseId
        }
      }

      if (dto.testSuiteId) {
        // Get the test suite from database to get the UUID for foreign key
        const testSuite = await this.testSuiteRepository.findOne({ 
          where: { suiteId: dto.testSuiteId, projectId } 
        });
        if (testSuite) {
          this.logger.log(`Found test suite with ID ${dto.testSuiteId}, using UUID: ${testSuite.id} for foreign key`);
          finalTestSuiteId = testSuite.id; // Use the database UUID for foreign key
        } else {
          this.logger.warn(`Test suite with ID ${dto.testSuiteId} not found in database, setting testSuiteId to null`);
          finalTestSuiteId = null; // Set to null to avoid foreign key constraint violation
        }
      }
    } else {
      // For manual creation, use the provided IDs directly
      finalTestCaseId = dto.testCaseId || null;
      finalTestSuiteId = dto.testSuiteId || null;
    }

    this.logger.log(`Final values - testCaseId: ${finalTestCaseId}, testSuiteId: ${finalTestSuiteId}`);

    const bug = this.bugRepository.create({
      bugId,
      projectId,
      testCaseId: finalTestCaseId, // This will be the UUID or null
      testSuiteId: finalTestSuiteId, // This will be the UUID or null
      executionId: dto.executionId,
      title: dto.title,
      description: dto.description,
      scenarioName: dto.scenarioName,
      testCaseName: readableTestCaseId, // Store the readable testCaseId here
      type: dto.type,
      severity: dto.severity,
      priority: dto.priority || BugPriority.MEDIUM,
      status: BugStatus.OPEN,
      errorMessage: dto.errorMessage,
      errorType: dto.errorType,
      errorStack: dto.errorStack,
      errorCode: dto.errorCode,
      section: bugSection,
      entity: bugEntity,
      method: dto.method,
      endpoint: bugEndpoint,
      requestData: dto.requestData,
      responseData: dto.responseData,
      executionTime: dto.executionTime,
      executionDate: dto.executionDate ? new Date(dto.executionDate) : new Date(),
      executionLogs: dto.executionLogs,
      consoleLogs: dto.consoleLogs,
      environment: dto.environment || 'default',
      reportedAt: new Date(),
    });

    try {
      const savedBug = await this.bugRepository.save(bug);
      this.logger.log(`Bug ${bugId} created successfully`);
      return this.mapToResponseDto(savedBug);
    } catch (error) {
      this.logger.error(`Failed to save bug: ${error.message}`);
      this.logger.error(`Bug data: ${JSON.stringify({
        bugId,
        projectId,
        testCaseId: finalTestCaseId,
        testSuiteId: finalTestSuiteId,
        executionId: dto.executionId,
        title: dto.title
      })}`);
      throw error;
    }
  }

  /**
   * Gets all bugs for a specific project with optional filters.
   * 
   * @param projectId - The project ID
   * @param filters - Optional filters for bug retrieval
   * @returns Promise<object> - Paginated list of bugs with metadata
   * @throws BadRequestException - If bugs table doesn't exist
   * 
   * @example
   * ```typescript
   * const result = await bugsService.getBugs('project-123', {
   *   severity: 'high',
   *   status: 'open',
   *   page: 1,
   *   limit: 10
   * });
   * console.log(`Found ${result.total} bugs`);
   * ```
   */
  async getBugs(projectId: string, filters: BugFiltersDto): Promise<{
    bugs: BugResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    this.logger.log(`Getting bugs for project: ${projectId}`);

    try {
      const queryBuilder = this.bugRepository.createQueryBuilder('b')
        .where('b.projectId = :projectId', { projectId });

    // Apply filters
    if (filters.type) {
      queryBuilder.andWhere('b.type = :type', { type: filters.type });
    }

    if (filters.severity) {
      queryBuilder.andWhere('b.severity = :severity', { severity: filters.severity });
    }

    if (filters.priority) {
      queryBuilder.andWhere('b.priority = :priority', { priority: filters.priority });
    }

    if (filters.status) {
      queryBuilder.andWhere('b.status = :status', { status: filters.status });
    }

    if (filters.section) {
      queryBuilder.andWhere('b.section = :section', { section: filters.section });
    }

    if (filters.entity) {
      queryBuilder.andWhere('b.entity = :entity', { entity: filters.entity });
    }

    if (filters.testCaseId) {
      queryBuilder.andWhere('b.testCaseId = :testCaseId', { testCaseId: filters.testCaseId });
    }

    if (filters.testSuiteId) {
      queryBuilder.andWhere('b.testSuiteId = :testSuiteId', { testSuiteId: filters.testSuiteId });
    }

    if (filters.executionId) {
      queryBuilder.andWhere('b.executionId = :executionId', { executionId: filters.executionId });
    }

    if (filters.environment) {
      queryBuilder.andWhere('b.environment = :environment', { environment: filters.environment });
    }

    if (filters.search) {
      queryBuilder.andWhere(
        '(b.title LIKE :search OR b.description LIKE :search OR b.scenarioName LIKE :search)',
        { search: `%${filters.search}%` }
      );
    }

    // Apply sorting
    const sortBy = filters.sortBy || 'reportedAt';
    const sortOrder = filters.sortOrder || 'DESC';
    queryBuilder.orderBy(`b.${sortBy}`, sortOrder);

    // Apply pagination
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const offset = (page - 1) * limit;

    queryBuilder.skip(offset).take(limit);

      const [bugs, total] = await queryBuilder.getManyAndCount();

      return {
        bugs: await Promise.all(bugs.map(bug => this.mapToResponseDto(bug))),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      this.logger.error(`Error getting bugs for project ${projectId}:`, error);
      if (error.message && error.message.includes('no such table')) {
        throw new BadRequestException('Bugs table does not exist. Please run database migrations.');
      }
      throw error;
    }
  }

  /**
   * Gets a specific bug by its ID.
   * 
   * @param projectId - The project ID
   * @param bugId - The bug ID
   * @returns Promise<BugResponseDto> - The bug details
   * @throws NotFoundException - If bug not found
   * 
   * @example
   * ```typescript
   * const bug = await bugsService.getBug('project-123', 'BUG-ECOMMERCE-001');
   * console.log(`Bug title: ${bug.title}`);
   * ```
   */
  async getBug(projectId: string, bugId: string): Promise<BugResponseDto> {
    this.logger.log(`Getting bug: ${bugId} for project: ${projectId}`);

    const bug = await this.bugRepository.findOne({
      where: { projectId, bugId }
    });

    if (!bug) {
      throw new NotFoundException(`Bug with ID ${bugId} not found`);
    }

    return this.mapToResponseDto(bug);
  }

  /**
   * Updates an existing bug.
   * 
   * @param projectId - The project ID
   * @param bugId - The bug ID
   * @param dto - The bug update data
   * @returns Promise<BugResponseDto> - The updated bug
   * @throws NotFoundException - If bug not found
   * 
   * @example
   * ```typescript
   * const updatedBug = await bugsService.updateBug('project-123', 'BUG-ECOMMERCE-001', {
   *   status: BugStatus.IN_PROGRESS,
   *   priority: BugPriority.HIGH
   * });
   * ```
   */
  async updateBug(projectId: string, bugId: string, dto: UpdateBugDto): Promise<BugResponseDto> {
    this.logger.log(`Updating bug: ${bugId} for project: ${projectId}`);

    const bug = await this.bugRepository.findOne({
      where: { projectId, bugId }
    });

    if (!bug) {
      throw new NotFoundException(`Bug with ID ${bugId} not found`);
    }

    // Update fields
    if (dto.title !== undefined) bug.title = dto.title;
    if (dto.description !== undefined) bug.description = dto.description;
    if (dto.type !== undefined) bug.type = dto.type;
    if (dto.severity !== undefined) bug.severity = dto.severity;
    if (dto.priority !== undefined) bug.priority = dto.priority;
    if (dto.status !== undefined) {
      bug.status = dto.status;
      if (dto.status === BugStatus.RESOLVED || dto.status === BugStatus.CLOSED) {
        bug.resolvedAt = new Date();
      }
    }
    if (dto.errorMessage !== undefined) bug.errorMessage = dto.errorMessage;
    if (dto.errorType !== undefined) bug.errorType = dto.errorType;
    if (dto.errorStack !== undefined) bug.errorStack = dto.errorStack;
    if (dto.errorCode !== undefined) bug.errorCode = dto.errorCode;
    if (dto.requestData !== undefined) bug.requestData = dto.requestData;
    if (dto.responseData !== undefined) bug.responseData = dto.responseData;
    if (dto.executionLogs !== undefined) bug.executionLogs = dto.executionLogs;
    if (dto.consoleLogs !== undefined) bug.consoleLogs = dto.consoleLogs;
    if (dto.environment !== undefined) bug.environment = dto.environment;

    const updatedBug = await this.bugRepository.save(bug);
    this.logger.log(`Bug ${bugId} updated successfully`);

    return this.mapToResponseDto(updatedBug);
  }

  /**
   * Deletes a bug.
   * 
   * @param projectId - The project ID
   * @param bugId - The bug ID
   * @returns Promise<{ success: boolean; message: string }> - Deletion result
   * @throws NotFoundException - If bug not found
   * 
   * @example
   * ```typescript
   * const result = await bugsService.deleteBug('project-123', 'BUG-ECOMMERCE-001');
   * console.log(result.message); // "Bug BUG-ECOMMERCE-001 deleted successfully"
   * ```
   */
  async deleteBug(projectId: string, bugId: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Deleting bug: ${bugId} for project: ${projectId}`);

    const bug = await this.bugRepository.findOne({
      where: { projectId, bugId }
    });

    if (!bug) {
      throw new NotFoundException(`Bug with ID ${bugId} not found`);
    }

    await this.bugRepository.remove(bug);

    return {
      success: true,
      message: `Bug ${bugId} deleted successfully`
    };
  }

  /**
   * Gets failed test executions for a specific project for bug creation.
   * 
   * @param projectId - The project ID
   * @returns Promise<Array<object>> - Array of failed execution details
   * 
   * @example
   * ```typescript
   * const failedExecutions = await bugsService.getFailedExecutions('project-123');
   * console.log(`Found ${failedExecutions.length} failed executions`);
   * ```
   */
  async getFailedExecutions(projectId: string): Promise<Array<{
    executionId: string;
    testCaseId: string;
    testCaseName: string;
    entityName: string;
    section: string;
    method: string;
    endpoint: string;
    errorMessage: string;
    executionDate: Date;
  }>> {
    this.logger.log(`Getting failed executions for project: ${projectId}`);

    // Get test cases that have failed executions
    const failedTestCases = await this.testCaseRepository
      .createQueryBuilder('tc')
      .where('tc.projectId = :projectId', { projectId })
      .andWhere('tc.lastRunStatus = :status', { status: 'failed' })
      .andWhere('tc.lastRun IS NOT NULL')
      .orderBy('tc.lastRun', 'DESC')
      .getMany();

    return failedTestCases.map(tc => ({
      executionId: tc.lastRun?.toISOString() || '',
      testCaseId: tc.testCaseId,
      testCaseName: tc.name,
      entityName: tc.entityName,
      section: tc.section,
      method: tc.method,
      endpoint: '', // TestCase doesn't have endpoint field
      errorMessage: 'Test execution failed', // TestCase doesn't have lastRunError field
      executionDate: tc.lastRun || new Date(),
    }));
  }

  /**
   * Creates a bug from a failed test execution.
   * 
   * @param projectId - The project ID
   * @param executionId - The execution ID
   * @param testCaseId - The test case ID
   * @param dto - Partial bug creation data
   * @returns Promise<BugResponseDto> - The created bug
   * @throws NotFoundException - If test case not found
   * 
   * @example
   * ```typescript
   * const bug = await bugsService.createBugFromFailedExecution(
   *   'project-123',
   *   'exec-456',
   *   'TC-ECOMMERCE-01',
   *   { severity: BugSeverity.HIGH }
   * );
   * ```
   */
  async createBugFromFailedExecution(
    projectId: string,
    executionId: string,
    testCaseId: string,
    dto: Partial<CreateBugDto>
  ): Promise<BugResponseDto> {
    this.logger.log(`Creating bug from failed execution: ${executionId}`);

    // Get the test case details
    const testCase = await this.testCaseRepository.findOne({
      where: { testCaseId, projectId }
    });

    if (!testCase) {
      throw new NotFoundException(`Test case with ID ${testCaseId} not found`);
    }

    // Create bug DTO with test case information
    const bugDto: CreateBugDto = {
      title: dto.title || `Test failure in ${testCase.name}`,
      description: dto.description || `Test case ${testCase.name} failed during execution`,
      type: dto.type || BugType.TEST_FAILURE,
      severity: dto.severity || BugSeverity.MEDIUM,
      priority: dto.priority || BugPriority.MEDIUM,
      testCaseId,
      executionId,
      scenarioName: testCase.name,
      testCaseName: testCase.name,
      errorMessage: dto.errorMessage || 'Test execution failed',
      section: testCase.section,
      entity: testCase.entityName,
      method: testCase.method,
      endpoint: '', // TestCase doesn't have endpoint field
      executionDate: testCase.lastRun || new Date(),
      environment: dto.environment || 'default',
    };

    return this.createBug(projectId, bugDto);
  }

  /**
   * Automatically creates bugs from test execution results.
   * This method is called automatically after each test execution.
   * 
   * @param projectId - The project ID
   * @param executionId - The execution ID
   * @param executionData - The execution metadata
   * @param testResults - Array of test results
   * @returns Promise<BugResponseDto[]> - Array of created bugs
   * 
   * @example
   * ```typescript
   * const bugs = await bugsService.createBugsFromExecutionResults(
   *   'project-123',
   *   'exec-456',
   *   { projectName: 'E-commerce API' },
   *   [{ status: 'failed', errorMessage: 'Expected 200, got 500' }]
   * );
   * ```
   */
  async createBugsFromExecutionResults(
    projectId: string,
    executionId: string,
    executionData: any,
    testResults: any[]
  ): Promise<BugResponseDto[]> {
    this.logger.log(`Creating bugs from execution results: ${executionId}`);

    const createdBugs: BugResponseDto[] = [];

    // Process each failed test result
    for (const result of testResults) {
      if (result.status === 'failed' && result.errorMessage) {
        try {
          // Extract error details from the result
          const errorDetails = this.extractErrorDetails(result);
          
          // Determine severity based on error type
          const severity = this.determineErrorSeverity(errorDetails.errorType, result);
          
          // Extract HTTP method
          const httpMethod = this.extractHttpMethod(result);
          
          // Extract test case ID (the actual testCaseId, not the database UUID)
          const testCaseId = this.extractTestCaseId(result);
          
          // Get test case data from database to extract section and entity
          const testCaseData = await this.getTestCaseDataFromDatabase(testCaseId || '', projectId);
          
          // Calculate actual execution time
          const actualExecutionTime = this.calculateActualExecutionTime(result);
          
          // Generate concise description
          const description = this.generateConciseBugDescription(result, executionData, testCaseId || 'Not found', actualExecutionTime);
          
          // Create bug DTO
          const bugDto: CreateBugDto = {
            title: `Test Failure: ${result.scenarioName}`,
            description: description,
            priority: BugPriority.MEDIUM,
            severity: severity,
            type: BugType.TEST_FAILURE,
            section: testCaseData?.section || 'Unknown',
            entity: testCaseData?.entity || 'Unknown',
            method: httpMethod,
            testCaseId: testCaseId, // Store the readable testCaseId
            testCaseName: testCaseData?.name || result.scenarioName,
            executionId: executionId,
            errorMessage: this.cleanErrorMessage(result.errorMessage),
            errorType: errorDetails.errorType,
            errorCode: errorDetails.errorCode,
            errorStack: errorDetails.errorStack,
            requestData: this.extractRequestDataFromSteps(result.steps || []),
            responseData: this.extractResponseDataFromSteps(result.steps || []),
            executionLogs: this.generateExecutionLogs(result, executionData),
            consoleLogs: this.generateConsoleLogs(result),
            executionTime: actualExecutionTime,
            environment: executionData.environment || 'default'
          };

          // Create the bug
          const createdBug = await this.createBug(projectId, bugDto);
          createdBugs.push(createdBug);
          
          this.logger.log(`Bug created for failed test: ${result.scenarioName}`);
        } catch (error) {
          this.logger.warn(`Failed to create bug for test ${result.scenarioName}: ${error.message}`);
        }
      }
    }

    this.logger.log(`Created ${createdBugs.length} bugs from execution ${executionId}`);
    return createdBugs;
  }

  /**
   * Extracts detailed error information from test result.
   * 
   * @private
   * @param result - The test result object
   * @returns Object containing error type, stack, code, and message
   */
  private extractErrorDetails(result: any): { errorType: string; errorStack: string; errorCode: string; errorMessage: string } {
    const errorMessage = result.errorMessage || '';
    
    // Extract status codes from error message
    const statusCodeMatch = errorMessage.match(/Expected:\s*(\d+)\s*\n\s*Received:\s*(\d+)/);
    const expectedStatus = statusCodeMatch ? statusCodeMatch[1] : '';
    const receivedStatus = statusCodeMatch ? statusCodeMatch[2] : '';
    
    // Determine error type based on content
    let errorType = 'Unknown';
    if (errorMessage.includes('expect(received).toBe(expected)')) {
      errorType = 'AssertionError';
    } else if (errorMessage.includes('timeout')) {
      errorType = 'TimeoutError';
    } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      errorType = 'NetworkError';
    } else if (errorMessage.includes('selector')) {
      errorType = 'SelectorError';
    } else if (errorMessage.includes('status code')) {
      errorType = 'HTTPStatusError';
    }
    
    // Extract error code
    let errorCode = '';
    if (expectedStatus && receivedStatus) {
      errorCode = `Expected: ${expectedStatus}, Received: ${receivedStatus}`;
    } else if (receivedStatus) {
      errorCode = receivedStatus;
    } else {
      // Try to extract any status code from the error message
      const statusMatch = errorMessage.match(/(\d{3})/);
      if (statusMatch) {
        errorCode = statusMatch[1];
      }
    }
    
    // Extract stack trace
    const stackTraceMatch = errorMessage.match(/at\s+.*\n.*\n.*/);
    const errorStack = stackTraceMatch ? stackTraceMatch[0] : errorMessage;
    
    return {
      errorType,
      errorStack,
      errorCode,
      errorMessage: errorMessage.substring(0, 500) // Limit error message length
    };
  }

  /**
   * Determines error severity based on error type and context.
   * 
   * @private
   * @param errorType - The type of error
   * @param result - The test result object
   * @returns BugSeverity - The determined severity level
   */
  private determineErrorSeverity(errorType: string, result: any): BugSeverity {
    const errorMessage = result.errorMessage || '';
    const scenarioName = result.scenarioName || '';
    
    // Critical errors - system failures
    if (errorMessage.includes('timeout') || 
        errorMessage.includes('network') || 
        errorMessage.includes('connection refused') ||
        errorMessage.includes('ECONNREFUSED')) {
      return BugSeverity.CRITICAL;
    }
    
    // High severity for critical business flows
    if (scenarioName.toLowerCase().includes('critical') ||
        scenarioName.toLowerCase().includes('payment') ||
        scenarioName.toLowerCase().includes('authentication') ||
        scenarioName.toLowerCase().includes('login')) {
      return BugSeverity.HIGH;
    }
    
    // High severity for HTTP 5xx errors (server errors)
    if (errorMessage.match(/Received:\s*5\d{2}/)) {
      return BugSeverity.HIGH;
    }
    
    // Medium for most assertion errors and HTTP 4xx errors
    if (errorMessage.includes('expect(') || 
        errorMessage.includes('toBe(') ||
        errorMessage.includes('AssertionError') ||
        errorMessage.match(/Received:\s*4\d{2}/)) {
      return BugSeverity.MEDIUM;
    }
    
    // Medium for status code mismatches (like 200 vs 201)
    if (errorMessage.includes('status code') && 
        (errorMessage.includes('Expected:') || errorMessage.includes('Received:'))) {
      return BugSeverity.MEDIUM;
    }
    
    return BugSeverity.LOW;
  }

  /**
   * Generates comprehensive bug description.
   * 
   * @private
   * @param result - The test result object
   * @param executionData - The execution metadata
   * @returns string - The generated description
   */
  private generateBugDescription(result: any, executionData: any): string {
    const description = [
      `Test case "${result.scenarioName}" failed during execution.`,
      '',
      `**Execution Details:**`,
      `- Project: ${executionData.projectName || 'Unknown'}`,
      `- Entity: ${executionData.entityName || 'Unknown'}`,
      `- Method: ${this.extractHttpMethod(result)}`,
      `- Environment: ${executionData.environment || 'default'}`,
      `- Execution Time: ${this.calculateActualExecutionTime(result)}ms (actual test steps)`,
      `- Total Time: ${result.duration}ms (including hooks)`,
      `- Execution ID: ${executionData.executionId}`,
      `- Test Case ID: ${this.extractTestCaseId(result) || 'Not found'}`,
      '',
      `**Error Details:**`,
      result.errorMessage,
      '',
      `**Test Steps:**`,
      ...(result.steps || []).map((step: any, index: number) => {
        const stepInfo = `${index + 1}. ${step.stepName} - ${step.status} (${step.duration}ms)`;
        if (step.status === 'failed' && step.errorMessage) {
          return `${stepInfo}\n   Error: ${step.errorMessage}`;
        }
        return stepInfo;
      }),
      '',
      `**Metadata:**`,
      `- Feature: ${result.metadata?.feature || 'Unknown'}`,
      `- Tags: ${result.metadata?.tags?.join(', ') || 'None'}`,
      `- Scenario ID: ${result.metadata?.scenarioId || 'Unknown'}`,
      `- Line: ${result.metadata?.line || 'Unknown'}`,
      `- Scenario Tags: ${result.scenarioTags?.join(', ') || 'None'}`,
      '',
      `**Failed Step Analysis:**`,
      ...(result.steps || [])
        .filter((step: any) => step.status === 'failed')
        .map((step: any, index: number) => [
          `Failed Step ${index + 1}:`,
          `- Name: ${step.stepName}`,
          `- Duration: ${step.duration}ms`,
          `- Type: ${step.isHook ? `${step.hookType} Hook` : 'Test Step'}`,
          `- Error: ${step.errorMessage || 'No specific error message'}`,
          ''
        ].join('\n')),
      '',
      `**Performance Analysis:**`,
      `- Total Steps: ${result.steps?.length || 0}`,
      `- Test Steps (excl. hooks): ${result.steps?.filter((s: any) => !s.isHook).length || 0}`,
      `- Hook Steps: ${result.steps?.filter((s: any) => s.isHook).length || 0}`,
      `- Passed Steps: ${result.steps?.filter((s: any) => s.status === 'passed').length || 0}`,
      `- Failed Steps: ${result.steps?.filter((s: any) => s.status === 'failed').length || 0}`,
      `- Skipped Steps: ${result.steps?.filter((s: any) => s.status === 'skipped').length || 0}`
    ].join('\n');

    return description;
  }

  /**
   * Generates concise bug description.
   * 
   * @private
   * @param result - The test result object
   * @param executionData - The execution metadata
   * @param testCaseId - The test case ID
   * @param actualExecutionTime - The actual execution time in milliseconds
   * @returns string - The generated concise description
   */
  private generateConciseBugDescription(result: any, executionData: any, testCaseId: string, actualExecutionTime: number): string {
    // Extract key information
    const failedSteps = (result.steps || []).filter((step: any) => step.status === 'failed');
    const errorDetails = this.extractErrorDetails(result);
    
    // Format execution time in seconds
    const actualTimeSeconds = (actualExecutionTime / 1000).toFixed(2);
    const totalTimeSeconds = (result.duration / 1000).toFixed(2);
    
    const description = [
      `**Test Case Failure Summary**`,
      `Test: ${result.scenarioName}`,
      `Project: ${executionData.projectName || 'Unknown'}`,
      `Entity: ${executionData.entityName || 'Unknown'}`,
      `Method: ${this.extractHttpMethod(result)}`,
      `Test Case ID: ${testCaseId}`,
      `Test Case Name: ${result.scenarioName}`,
      `Execution ID: ${executionData.executionId}`,
      `Duration: ${actualTimeSeconds}s (test steps) / ${totalTimeSeconds}s (total)`,
      '',
      `**Error Details**`,
      `Type: ${errorDetails.errorType}`,
      `Code: ${errorDetails.errorCode || 'N/A'}`,
      `Message: ${this.cleanErrorMessage(result.errorMessage)}`,
      '',
      `**Failed Steps (${failedSteps.length})**`,
      ...failedSteps.map((step: any, index: number) => 
        `${index + 1}. ${step.stepName} (${step.duration}ms)`
      ),
      '',
      `**Context**`,
      `Feature: ${result.metadata?.feature || 'Unknown'}`,
      `Environment: ${executionData.environment || 'default'}`,
      `Total Steps: ${result.steps?.length || 0}`,
      `Passed: ${result.steps?.filter((s: any) => s.status === 'passed').length || 0}`,
      `Failed: ${failedSteps.length}`,
      `Skipped: ${result.steps?.filter((s: any) => s.status === 'skipped').length || 0}`
    ].join('\n');

    return description;
  }

  /**
   * Extracts endpoint information from test steps.
   * 
   * @private
   * @param steps - Array of test steps
   * @returns string - The extracted endpoint information
   */
  private extractEndpointFromSteps(steps: any[]): string {
    if (!steps) return '';
    
    // Look for steps that might contain endpoint information
    for (const step of steps) {
      const stepName = step.stepName?.toLowerCase() || '';
      
      // Look for API/HTTP related steps
      if (stepName.includes('endpoint') || 
          stepName.includes('url') || 
          stepName.includes('api') ||
          stepName.includes('get') ||
          stepName.includes('post') ||
          stepName.includes('put') ||
          stepName.includes('delete')) {
        
        // Try to extract URL/endpoint from step name
        const urlMatch = step.stepName.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
          return urlMatch[1];
        }
        
        // Extract method and entity from step name
        const methodMatch = step.stepName.match(/(get|post|put|delete)\s+(.+?)\s+(?:by|with|from)/i);
        if (methodMatch) {
          return `${methodMatch[1].toUpperCase()} ${methodMatch[2]}`;
        }
        
        // Extract just the method and entity if no specific pattern
        const simpleMatch = step.stepName.match(/(get|post|put|delete)\s+(.+)/i);
        if (simpleMatch) {
          return `${simpleMatch[1].toUpperCase()} ${simpleMatch[2]}`;
        }
      }
    }
    
    return '';
  }

  /**
   * Extracts request data from test steps.
   * 
   * @private
   * @param steps - Array of test steps
   * @returns any - The extracted request data
   */
  private extractRequestDataFromSteps(steps: any[]): any {
    if (!steps) return null;
    
    const requestData: any = {
      method: 'Unknown',
      steps: []
    };
    
    // Look for steps that might contain request data
    for (const step of steps) {
      const stepName = step.stepName?.toLowerCase() || '';
      
      if (stepName.includes('send') || 
          stepName.includes('post') || 
          stepName.includes('put') ||
          stepName.includes('get') ||
          stepName.includes('delete')) {
        
        // Extract HTTP method
        const methodMatch = step.stepName.match(/(get|post|put|delete)/i);
        if (methodMatch) {
          requestData.method = methodMatch[1].toUpperCase();
        }
        
        requestData.steps.push({
          step: step.stepName,
          status: step.status,
          duration: step.duration
        });
      }
    }
    
    return requestData.steps.length > 0 ? requestData : null;
  }

  /**
   * Extracts response data from test steps.
   * 
   * @private
   * @param steps - Array of test steps
   * @returns any - The extracted response data
   */
  private extractResponseDataFromSteps(steps: any[]): any {
    if (!steps) return null;
    
    const responseData: any = {
      expectedStatus: null,
      receivedStatus: null,
      steps: []
    };
    
    // Look for steps that might contain response data
    for (const step of steps) {
      const stepName = step.stepName?.toLowerCase() || '';
      
      if (stepName.includes('receive') || 
          stepName.includes('response') || 
          stepName.includes('status') ||
          stepName.includes('should')) {
        
        // Extract status codes
        const statusMatch = step.stepName.match(/(\d{3})\s*status\s*code/i);
        if (statusMatch) {
          responseData.expectedStatus = statusMatch[1];
        }
        
        // Extract from error message if step failed
        if (step.status === 'failed' && step.errorMessage) {
          const expectedMatch = step.errorMessage.match(/Expected:\s*(\d+)/);
          const receivedMatch = step.errorMessage.match(/Received:\s*(\d+)/);
          
          if (expectedMatch) {
            responseData.expectedStatus = expectedMatch[1];
          }
          if (receivedMatch) {
            responseData.receivedStatus = receivedMatch[1];
          }
        }
        
        responseData.steps.push({
          step: step.stepName,
          status: step.status,
          duration: step.duration,
          errorMessage: step.status === 'failed' ? this.cleanErrorMessage(step.errorMessage) : step.errorMessage
        });
      }
    }
    
    return responseData.steps.length > 0 ? responseData : null;
  }

  /**
   * Generates execution logs from test result.
   * 
   * @private
   * @param result - The test result object
   * @param executionData - The execution metadata
   * @returns string - The generated execution logs
   */
  private generateExecutionLogs(result: any, executionData: any): string {
    const logs = [
      `=== EXECUTION SUMMARY ===`,
      `Execution ID: ${executionData.executionId}`,
      `Project: ${executionData.projectName || 'Unknown'}`,
      `Entity: ${executionData.entityName || 'Unknown'}`,
      `Method: ${executionData.method || 'Unknown'}`,
      `Environment: ${executionData.environment || 'default'}`,
      `Started: ${executionData.startedAt || new Date()}`,
      `Duration: ${result.duration}ms`,
      `Status: ${result.status}`,
      '',
      `=== TEST STEPS EXECUTION ===`,
      ...(result.steps || []).map((step: any, index: number) => {
        const stepLog = [
          `[${index + 1}] ${step.stepName}`,
          `  Status: ${step.status?.toUpperCase()}`,
          `  Duration: ${step.duration}ms`,
          `  Type: ${step.isHook ? `${step.hookType} Hook` : 'Test Step'}`
        ];
        
        if (step.status === 'failed' && step.errorMessage) {
          stepLog.push(`  Error: ${step.errorMessage}`);
        }
        
        return stepLog.join('\n');
      }),
      '',
      `=== METADATA ===`,
      `Feature: ${result.metadata?.feature || 'Unknown'}`,
      `Tags: ${result.metadata?.tags?.join(', ') || 'None'}`,
      `Scenario ID: ${result.metadata?.scenarioId || 'Unknown'}`,
      `Line: ${result.metadata?.line || 'Unknown'}`,
      `Scenario Tags: ${result.scenarioTags?.join(', ') || 'None'}`
    ].join('\n');

    return logs;
  }

  /**
   * Generates console logs from test result.
   * 
   * @private
   * @param result - The test result object
   * @returns string - The generated console logs
   */
  private generateConsoleLogs(result: any): string {
    if (!result.errorMessage) return '';
    
    return `Error: ${result.errorMessage}`;
  }

  /**
   * Gets bug statistics for a specific project.
   * 
   * @param projectId - The project ID
   * @returns Promise<object> - Statistics object with counts by status, severity, type, and priority
   * @throws BadRequestException - If bugs table doesn't exist
   * 
   * @example
   * ```typescript
   * const stats = await bugsService.getBugStatistics('project-123');
   * console.log(`Project has ${stats.total} bugs, ${stats.open} open`);
   * ```
   */
  async getBugStatistics(projectId: string): Promise<{
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
    bySeverity: { [key: string]: number };
    byType: { [key: string]: number };
    byPriority: { [key: string]: number };
  }> {
    this.logger.log(`Getting bug statistics for project: ${projectId}`);

    try {
      const [bugs, severityStats, typeStats, priorityStats] = await Promise.all([
      this.bugRepository.find({ where: { projectId } }),
      this.bugRepository
        .createQueryBuilder('b')
        .select('b.severity', 'severity')
        .addSelect('COUNT(*)', 'count')
        .where('b.projectId = :projectId', { projectId })
        .groupBy('b.severity')
        .getRawMany(),
      this.bugRepository
        .createQueryBuilder('b')
        .select('b.type', 'type')
        .addSelect('COUNT(*)', 'count')
        .where('b.projectId = :projectId', { projectId })
        .groupBy('b.type')
        .getRawMany(),
      this.bugRepository
        .createQueryBuilder('b')
        .select('b.priority', 'priority')
        .addSelect('COUNT(*)', 'count')
        .where('b.projectId = :projectId', { projectId })
        .groupBy('b.priority')
        .getRawMany(),
    ]);

    const bySeverity = severityStats.reduce((acc, stat) => {
      acc[stat.severity] = parseInt(stat.count);
      return acc;
    }, {} as { [key: string]: number });

    const byType = typeStats.reduce((acc, stat) => {
      acc[stat.type] = parseInt(stat.count);
      return acc;
    }, {} as { [key: string]: number });

    const byPriority = priorityStats.reduce((acc, stat) => {
      acc[stat.priority] = parseInt(stat.count);
      return acc;
    }, {} as { [key: string]: number });

      return {
        total: bugs.length,
        open: bugs.filter(b => b.status === BugStatus.OPEN).length,
        inProgress: bugs.filter(b => b.status === BugStatus.IN_PROGRESS).length,
        resolved: bugs.filter(b => b.status === BugStatus.RESOLVED).length,
        closed: bugs.filter(b => b.status === BugStatus.CLOSED).length,
        bySeverity,
        byType,
        byPriority,
      };
    } catch (error) {
      this.logger.error(`Error getting bug statistics for project ${projectId}:`, error);
      if (error.message && error.message.includes('no such table')) {
        throw new BadRequestException('Bugs table does not exist. Please run database migrations.');
      }
      throw error;
    }
  }

  /**
   * Generates a unique bug ID based on project, section, and entity.
   * 
   * @private
   * @param projectName - The project name
   * @param section - The section name
   * @param entity - The entity name
   * @returns Promise<string> - The generated bug ID
   */
  private async generateBugId(projectName: string, section: string, entity: string): Promise<string> {
    // Normalize section and entity to avoid duplicates
    const normalizedSection = section?.toUpperCase() || 'GENERAL';
    const normalizedEntity = entity?.toUpperCase() || 'GENERAL';
    
    // If section and entity are the same, use only one
    const identifier = normalizedSection === normalizedEntity 
      ? normalizedSection 
      : `${normalizedSection}-${normalizedEntity}`;

    const lastBug = await this.bugRepository
      .createQueryBuilder('b')
      .where('b.bugId LIKE :pattern', { pattern: `BUG-${identifier}-%` })
      .orderBy('b.bugId', 'DESC')
      .getOne();

    let nextId = 1;
    if (lastBug) {
      const match = lastBug.bugId.match(/-(\d+)$/);
      if (match) {
        nextId = parseInt(match[1]) + 1;
      }
    }

    return `BUG-${identifier}-${nextId.toString().padStart(3, '0')}`;
  }

  /**
   * Maps a Bug entity to BugResponseDto.
   * 
   * @private
   * @param bug - The bug entity
   * @returns Promise<BugResponseDto> - The mapped response DTO
   */
  private async mapToResponseDto(bug: Bug): Promise<BugResponseDto> {
    // Get the real test case name from database if we have a readable testCaseId
    let realTestCaseName = bug.testCaseName;
    let readableTestCaseId = bug.testCaseName; // This currently stores the readable testCaseId

    // If testCaseName contains a TC- pattern, it's actually the readable testCaseId
    // We need to query the database to get the real test case name
    if (bug.testCaseName && bug.testCaseName.startsWith('TC-')) {
      try {
        const testCase = await this.testCaseRepository.findOne({
          where: { testCaseId: bug.testCaseName }
        });
        if (testCase) {
          realTestCaseName = testCase.name; // Get the real test case name
          readableTestCaseId = bug.testCaseName; // Keep the readable testCaseId
        }
      } catch (error) {
        this.logger.warn(`Failed to get test case name for ${bug.testCaseName}: ${error.message}`);
        // Keep the current values if query fails
      }
    }

    return {
      id: bug.id.toString(),
      bugId: bug.bugId,
      projectId: bug.projectId,
      testCaseId: readableTestCaseId, // Return the readable testCaseId
      testSuiteId: bug.testSuiteId || undefined,
      executionId: bug.executionId,
      title: bug.title,
      description: bug.description,
      scenarioName: bug.scenarioName,
      testCaseName: realTestCaseName, // Return the real test case name
      type: bug.type,
      severity: bug.severity,
      priority: bug.priority,
      status: bug.status,
      errorMessage: bug.errorMessage,
      errorType: bug.errorType,
      errorStack: bug.errorStack,
      errorCode: bug.errorCode,
      section: bug.section,
      entity: bug.entity,
      method: bug.method,
      endpoint: bug.endpoint,
      requestData: bug.requestData,
      responseData: bug.responseData,
      executionTime: bug.executionTime,
      executionDate: bug.executionDate,
      executionLogs: bug.executionLogs,
      consoleLogs: bug.consoleLogs,
      environment: bug.environment,
      reportedAt: bug.reportedAt,
      resolvedAt: bug.resolvedAt,
      createdAt: bug.createdAt,
      updatedAt: bug.updatedAt,
    };
  }

  /**
   * Gets all bugs across all projects with optional filters.
   * 
   * @param filters - Optional filters for bug retrieval
   * @returns Promise<object> - Paginated list of bugs with metadata
   * @throws BadRequestException - If bugs table doesn't exist
   * 
   * @example
   * ```typescript
   * const result = await bugsService.getAllBugs({
   *   severity: 'high',
   *   status: 'open',
   *   page: 1,
   *   limit: 20
   * });
   * console.log(`Found ${result.total} bugs across all projects`);
   * ```
   */
  async getAllBugs(filters: BugFiltersDto): Promise<{
    bugs: BugResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    this.logger.log('Getting all bugs (general endpoint)');

    try {
      const queryBuilder = this.bugRepository.createQueryBuilder('b');

      // Apply filters
      if (filters.type) {
        queryBuilder.andWhere('b.type = :type', { type: filters.type });
      }

      if (filters.severity) {
        queryBuilder.andWhere('b.severity = :severity', { severity: filters.severity });
      }

      if (filters.priority) {
        queryBuilder.andWhere('b.priority = :priority', { priority: filters.priority });
      }

      if (filters.status) {
        queryBuilder.andWhere('b.status = :status', { status: filters.status });
      }

      if (filters.section) {
        queryBuilder.andWhere('b.section = :section', { section: filters.section });
      }

      if (filters.entity) {
        queryBuilder.andWhere('b.entity = :entity', { entity: filters.entity });
      }

      if (filters.testCaseId) {
        queryBuilder.andWhere('b.testCaseId = :testCaseId', { testCaseId: filters.testCaseId });
      }

      if (filters.testSuiteId) {
        queryBuilder.andWhere('b.testSuiteId = :testSuiteId', { testSuiteId: filters.testSuiteId });
      }

      if (filters.executionId) {
        queryBuilder.andWhere('b.executionId = :executionId', { executionId: filters.executionId });
      }

      if (filters.environment) {
        queryBuilder.andWhere('b.environment = :environment', { environment: filters.environment });
      }

      if (filters.search) {
        queryBuilder.andWhere(
          '(b.title LIKE :search OR b.description LIKE :search OR b.scenarioName LIKE :search)',
          { search: `%${filters.search}%` }
        );
      }

      // Apply sorting
      const sortBy = filters.sortBy || 'reportedAt';
      const sortOrder = filters.sortOrder || 'DESC';
      queryBuilder.orderBy(`b.${sortBy}`, sortOrder);

      // Apply pagination
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const offset = (page - 1) * limit;

      queryBuilder.skip(offset).take(limit);

      const [bugs, total] = await queryBuilder.getManyAndCount();

      return {
        bugs: await Promise.all(bugs.map(bug => this.mapToResponseDto(bug))),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      this.logger.error('Error getting all bugs:', error);
      if (error.message && error.message.includes('no such table')) {
        throw new BadRequestException('Bugs table does not exist. Please run database migrations.');
      }
      throw error;
    }
  }

  /**
   * Gets comprehensive bug statistics across all projects.
   * 
   * @returns Promise<object> - Statistics object with counts by status, severity, type, and priority
   * @throws BadRequestException - If bugs table doesn't exist
   * 
   * @example
   * ```typescript
   * const stats = await bugsService.getAllBugStatistics();
   * console.log(`Total bugs: ${stats.total}, Open: ${stats.open}`);
   * ```
   */
  async getAllBugStatistics(): Promise<{
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
    bySeverity: { [key: string]: number };
    byType: { [key: string]: number };
    byPriority: { [key: string]: number };
  }> {
    this.logger.log('Getting all bug statistics (general endpoint)');

    try {
      const [bugs, severityStats, typeStats, priorityStats] = await Promise.all([
        this.bugRepository.find(),
        this.bugRepository
          .createQueryBuilder('b')
          .select('b.severity', 'severity')
          .addSelect('COUNT(*)', 'count')
          .groupBy('b.severity')
          .getRawMany(),
        this.bugRepository
          .createQueryBuilder('b')
          .select('b.type', 'type')
          .addSelect('COUNT(*)', 'count')
          .groupBy('b.type')
          .getRawMany(),
        this.bugRepository
          .createQueryBuilder('b')
          .select('b.priority', 'priority')
          .addSelect('COUNT(*)', 'count')
          .groupBy('b.priority')
          .getRawMany(),
      ]);

      const bySeverity = severityStats.reduce((acc, stat) => {
        acc[stat.severity] = parseInt(stat.count);
        return acc;
      }, {} as { [key: string]: number });

      const byType = typeStats.reduce((acc, stat) => {
        acc[stat.type] = parseInt(stat.count);
        return acc;
      }, {} as { [key: string]: number });

      const byPriority = priorityStats.reduce((acc, stat) => {
        acc[stat.priority] = parseInt(stat.count);
        return acc;
      }, {} as { [key: string]: number });

      return {
        total: bugs.length,
        open: bugs.filter(b => b.status === BugStatus.OPEN).length,
        inProgress: bugs.filter(b => b.status === BugStatus.IN_PROGRESS).length,
        resolved: bugs.filter(b => b.status === BugStatus.RESOLVED).length,
        closed: bugs.filter(b => b.status === BugStatus.CLOSED).length,
        bySeverity,
        byType,
        byPriority,
      };
    } catch (error) {
      this.logger.error('Error getting all bug statistics:', error);
      if (error.message && error.message.includes('no such table')) {
        throw new BadRequestException('Bugs table does not exist. Please run database migrations.');
      }
      throw error;
    }
  }

  /**
   * Gets all failed test executions across all projects for bug creation.
   * 
   * @returns Promise<Array<object>> - Array of failed execution details
   * @throws BadRequestException - If required tables don't exist
   * 
   * @example
   * ```typescript
   * const failedExecutions = await bugsService.getAllFailedExecutions();
   * console.log(`Found ${failedExecutions.length} failed executions across all projects`);
   * ```
   */
  async getAllFailedExecutions(): Promise<Array<{
    executionId: string;
    testCaseId: string;
    testCaseName: string;
    entityName: string;
    section: string;
    method: string;
    endpoint: string;
    errorMessage: string;
    executionDate: Date;
  }>> {
    this.logger.log('Getting all failed executions (general endpoint)');

    try {
      // Get test cases that have failed executions
      const failedTestCases = await this.testCaseRepository
        .createQueryBuilder('tc')
        .where('tc.lastRunStatus = :status', { status: 'failed' })
        .andWhere('tc.lastRun IS NOT NULL')
        .orderBy('tc.lastRun', 'DESC')
        .getMany();

      return failedTestCases.map(tc => ({
        executionId: tc.lastRun?.toISOString() || '',
        testCaseId: tc.testCaseId,
        testCaseName: tc.name,
        entityName: tc.entityName,
        section: tc.section,
        method: tc.method,
        endpoint: '', // TestCase doesn't have endpoint field
        errorMessage: 'Test execution failed', // TestCase doesn't have lastRunError field
        executionDate: tc.lastRun || new Date(),
      }));
    } catch (error) {
      this.logger.error('Error getting all failed executions:', error);
      if (error.message && error.message.includes('no such table')) {
        throw new BadRequestException('Required tables do not exist. Please run database migrations.');
      }
      throw error;
    }
  }

  /**
   * Extracts HTTP method from test result.
   * 
   * @private
   * @param result - The test result object
   * @returns string - The extracted HTTP method
   */
  private extractHttpMethod(result: any): string {
    const scenarioName = result.scenarioName?.toLowerCase() || '';
    const steps = result.steps || [];
    
    // Look for HTTP method in scenario name
    const methodMatch = scenarioName.match(/(get|post|put|delete|patch)\s+/i);
    if (methodMatch) {
      return methodMatch[1].toUpperCase();
    }
    
    // Look for HTTP method in steps
    for (const step of steps) {
      const stepName = step.stepName?.toLowerCase() || '';
      const stepMethodMatch = stepName.match(/(get|post|put|delete|patch)\s+/i);
      if (stepMethodMatch) {
        return stepMethodMatch[1].toUpperCase();
      }
    }
    
    // Look for HTTP method in metadata tags
    const tags = result.metadata?.tags || [];
    for (const tag of tags) {
      const tagLower = tag.toLowerCase();
      if (tagLower.includes('get') || tagLower.includes('post') || 
          tagLower.includes('put') || tagLower.includes('delete') || 
          tagLower.includes('patch')) {
        const tagMethodMatch = tagLower.match(/(get|post|put|delete|patch)/i);
        if (tagMethodMatch) {
          return tagMethodMatch[1].toUpperCase();
        }
      }
    }
    
    return 'Unknown';
  }

  /**
   * Extracts test case ID from test result.
   * 
   * @private
   * @param result - The test result object
   * @returns string | undefined - The extracted test case ID
   */
  private extractTestCaseId(result: any): string | undefined {
    // Look for test case ID in scenario tags
    const scenarioTags = result.scenarioTags || [];
    for (const tag of scenarioTags) {
      if (tag.startsWith('@TC-')) {
        return tag.substring(1); // Remove @ prefix
      }
    }
    
    // Look for test case ID in metadata tags
    const metadataTags = result.metadata?.tags || [];
    for (const tag of metadataTags) {
      if (tag.startsWith('@TC-')) {
        return tag.substring(1); // Remove @ prefix
      }
    }
    
    // Look for test case ID in scenario ID
    const scenarioId = result.metadata?.scenarioId;
    if (scenarioId && scenarioId.includes('tc-')) {
      const tcMatch = scenarioId.match(/tc-[^;]+/i);
      if (tcMatch) {
        return tcMatch[0].toUpperCase();
      }
    }
    
    // If no TC- tag found, try to construct one from scenario name
    if (result.scenarioName) {
      const scenarioName = result.scenarioName.replace(/\s+/g, '-');
      const entity = result.metadata?.feature?.replace(/\s+/g, '-') || 'Unknown';
      return `TC-${entity}-${scenarioName}`;
    }
    
    return undefined;
  }

  /**
   * Extracts section from test result.
   * 
   * @private
   * @param result - The test result object
   * @returns string - The extracted section
   */
  private extractSectionFromResult(result: any): string {
    // Look for section in metadata tags
    const metadataTags = result.metadata?.tags || [];
    for (const tag of metadataTags) {
      if (tag.toLowerCase().includes('section:')) {
        const sectionMatch = tag.match(/section:\s*(.+)/i);
        if (sectionMatch) {
          return sectionMatch[1].trim();
        }
      }
    }

    // Look for section in scenario tags
    const scenarioTags = result.scenarioTags || [];
    for (const tag of scenarioTags) {
      if (tag.toLowerCase().includes('section:')) {
        const sectionMatch = tag.match(/section:\s*(.+)/i);
        if (sectionMatch) {
          return sectionMatch[1].trim();
        }
      }
    }

    // Look for section in scenario name
    const scenarioName = result.scenarioName?.toLowerCase() || '';
    const sectionMatch = scenarioName.match(/section:\s*(.+?)\s*$/i);
    if (sectionMatch) {
      return sectionMatch[1].trim();
    }

    // Look for section in steps
    const steps = result.steps || [];
    for (const step of steps) {
      const stepName = step.stepName?.toLowerCase() || '';
      const sectionMatch = stepName.match(/section:\s*(.+?)\s*$/i);
      if (sectionMatch) {
        return sectionMatch[1].trim();
      }
    }

    // Fallback to feature name if section not found
    return result.metadata?.feature?.replace(/\s+/g, '-') || 'Unknown';
  }

  /**
   * Extracts entity from test result.
   * 
   * @private
   * @param result - The test result object
   * @returns string - The extracted entity
   */
  private extractEntityFromResult(result: any): string {
    // Look for entity in metadata tags
    const metadataTags = result.metadata?.tags || [];
    for (const tag of metadataTags) {
      if (tag.toLowerCase().includes('entity:')) {
        const entityMatch = tag.match(/entity:\s*(.+)/i);
        if (entityMatch) {
          return entityMatch[1].trim();
        }
      }
    }

    // Look for entity in scenario tags
    const scenarioTags = result.scenarioTags || [];
    for (const tag of scenarioTags) {
      if (tag.toLowerCase().includes('entity:')) {
        const entityMatch = tag.match(/entity:\s*(.+)/i);
        if (entityMatch) {
          return entityMatch[1].trim();
        }
      }
    }

    // Look for entity in scenario name
    const scenarioName = result.scenarioName?.toLowerCase() || '';
    const entityMatch = scenarioName.match(/entity:\s*(.+?)\s*$/i);
    if (entityMatch) {
      return entityMatch[1].trim();
    }

    // Look for entity in steps
    const steps = result.steps || [];
    for (const step of steps) {
      const stepName = step.stepName?.toLowerCase() || '';
      const entityMatch = stepName.match(/entity:\s*(.+?)\s*$/i);
      if (entityMatch) {
        return entityMatch[1].trim();
      }
    }

    // Try to extract entity from test case ID
    const testCaseId = this.extractTestCaseId(result);
    if (testCaseId) {
      const tcMatch = testCaseId.match(/TC-[^-]+-([^-]+)/);
      if (tcMatch) {
        return tcMatch[1];
      }
    }

    // Fallback to feature name if entity not found
    return result.metadata?.feature?.replace(/\s+/g, '-') || 'Unknown';
  }

  /**
   * Calculates actual execution time excluding hooks.
   * 
   * @private
   * @param result - The test result object
   * @returns number - The actual execution time in milliseconds
   */
  private calculateActualExecutionTime(result: any): number {
    // Sum the duration of all steps. Cucumber.js reports duration in nanoseconds.
    // Convert nanoseconds to milliseconds.
    const totalDurationNs = (result.steps || []).reduce((sum: number, step: any) => sum + (step.duration || 0), 0);
    return totalDurationNs / 1_000_000; // Convert nanoseconds to milliseconds
  }

  /**
   * Gets test case data from database by test case ID.
   * 
   * @private
   * @param testCaseId - The test case ID
   * @param projectId - The project ID
   * @returns Promise<object | null> - The test case data or null if not found
   */
  private async getTestCaseDataFromDatabase(testCaseId: string, projectId: string): Promise<{ id: string; name: string; section: string; entity: string; endpointPath: string | null } | null> {
    const testCase = await this.testCaseRepository.findOne({
      where: { testCaseId, projectId }
    });

    if (!testCase) {
      return null;
    }

    let endpointPath: string | null = null;
    // Try to find endpoint using entityName and projectId
    const endpoint = await this.endpointRepository.findOne({
      where: { entityName: testCase.entityName, projectId: testCase.projectId },
    });
    if (endpoint) {
      endpointPath = endpoint.path;
    }

    return {
      id: testCase.id,
      name: testCase.name,
      section: testCase.section,
      entity: testCase.entityName,
      endpointPath: endpointPath,
    };
  }

  /**
   * Cleans error message by removing stack traces and unnecessary information.
   * 
   * @private
   * @param errorMessage - The raw error message
   * @returns string - The cleaned error message
   */
  private cleanErrorMessage(errorMessage: string): string {
    if (!errorMessage) return '';
    
    // Remove stack traces (lines starting with "at ")
    let cleaned = errorMessage.replace(/at\s+.*\n.*\n.*/g, '').trim();
    
    // Remove file paths in parentheses
    cleaned = cleaned.replace(/\([^)]*\)/g, '').trim();
    
    // Remove status codes from error message if they are present
    cleaned = cleaned.replace(/Expected:\s*\d+\s*\n\s*Received:\s*\d+/g, '').trim();
    
    // Remove "at Proxy.<anonymous>" and similar patterns
    cleaned = cleaned.replace(/at\s+Proxy\.<anonymous>/g, '').trim();
    cleaned = cleaned.replace(/at\s+CustomWorld\.<anonymous>/g, '').trim();
    
    // Remove extra whitespace and newlines
    cleaned = cleaned.replace(/\n+/g, '\n').trim();
    
    // Remove trailing "// Object.is equality" if present
    cleaned = cleaned.replace(/\s*\/\/\s*Object\.is equality\s*$/g, '').trim();
    
    return cleaned;
  }
}
