import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Put,
  Delete,
  Query,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { TestSuitesService } from '../services/test-suites.service';
import { CreateTestSuiteDto } from '../dto/create-test-suite.dto';
import { UpdateTestSuiteDto } from '../dto/update-test-suite.dto';
import { TestSuiteResponseDto } from '../dto/test-suite-response.dto';
import { TestSuiteFiltersDto } from '../dto/test-suite-filters.dto';
import { ExecuteTestSuiteDto } from '../dto/execute-test-suite.dto';

/**
 * Test Suites Controller
 * 
 * Handles HTTP requests for test suite management operations.
 * Provides endpoints for creating, reading, updating, deleting, and executing
 * test suites (test sets and test plans) within projects.
 * 
 * @controller TestSuitesController
 */
@ApiTags('test-suites')
@Controller('projects/:projectId/test-suites')
export class TestSuitesController {
  private readonly logger = new Logger(TestSuitesController.name);

  constructor(private readonly testSuitesService: TestSuitesService) {}

  /**
   * Creates a new test suite (test set or test plan).
   * 
   * @param projectId - The project ID
   * @param dto - The test suite creation data
   * @returns Promise<TestSuiteResponseDto> - The created test suite
   * @throws 400 - Invalid input data
   * @throws 404 - Project not found
   * 
   * @example
   * ```typescript
   * const testSuite = await testSuitesController.createTestSuite('project-123', {
   *   name: 'E2E Tests',
   *   type: 'test_set',
   *   description: 'End-to-end test suite'
   * });
   * ```
   */
  @Post()
  @ApiOperation({
    summary: 'Create test suite',
    description: 'Create a new test suite (test set or test plan)',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: 'string' })
  @ApiResponse({
    status: 201,
    description: 'Test suite created successfully',
    type: TestSuiteResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async createTestSuite(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTestSuiteDto,
  ) {
    this.logger.log(`Creating test suite for project: ${projectId}`);
    return await this.testSuitesService.createTestSuite(projectId, dto);
  }

  /**
   * Gets all test suites for a project with optional filters.
   * 
   * @param projectId - The project ID
   * @param filters - Optional filters for test suite retrieval
   * @returns Promise<TestSuiteResponseDto[]> - Array of test suites
   * 
   * @example
   * ```typescript
   * const testSuites = await testSuitesController.getTestSuites('project-123', {
   *   type: 'test_set',
   *   status: 'active',
   *   page: 1,
   *   limit: 10
   * });
   * ```
   */
  @Get()
  @ApiOperation({
    summary: 'Get test suites',
    description: 'Get all test suites for a project with optional filters',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: 'string' })
  @ApiQuery({ name: 'type', required: false, enum: ['test_set', 'test_plan'] })
  @ApiQuery({ name: 'status', required: false, enum: ['draft', 'active', 'completed', 'archived'] })
  @ApiQuery({ name: 'section', required: false, type: 'string' })
  @ApiQuery({ name: 'entity', required: false, type: 'string' })
  @ApiQuery({ name: 'page', required: false, type: 'number' })
  @ApiQuery({ name: 'limit', required: false, type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Test suites retrieved successfully',
    type: [TestSuiteResponseDto],
  })
  async getTestSuites(
    @Param('projectId') projectId: string,
    @Query() filters: TestSuiteFiltersDto,
  ) {
    this.logger.log(`Getting test suites for project: ${projectId}`);
    return await this.testSuitesService.getTestSuites(projectId, filters);
  }

  /**
   * Gets a specific test suite by its ID.
   * 
   * @param projectId - The project ID
   * @param suiteId - The test suite ID
   * @returns Promise<TestSuiteResponseDto> - The test suite
   * @throws 404 - Test suite not found
   * 
   * @example
   * ```typescript
   * const testSuite = await testSuitesController.getTestSuite('project-123', 'suite-456');
   * ```
   */
  @Get(':suiteId')
  @ApiOperation({
    summary: 'Get test suite by ID',
    description: 'Get a specific test suite by its ID',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: 'string' })
  @ApiParam({ name: 'suiteId', description: 'Test suite ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Test suite retrieved successfully',
    type: TestSuiteResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Test suite not found' })
  async getTestSuite(
    @Param('projectId') projectId: string,
    @Param('suiteId') suiteId: string,
  ) {
    this.logger.log(`Getting test suite: ${suiteId} for project: ${projectId}`);
    return await this.testSuitesService.getTestSuite(projectId, suiteId);
  }

  /**
   * Updates an existing test suite.
   * 
   * @param projectId - The project ID
   * @param suiteId - The test suite ID
   * @param dto - The test suite update data
   * @returns Promise<TestSuiteResponseDto> - The updated test suite
   * @throws 400 - Invalid input data
   * @throws 404 - Test suite not found
   * 
   * @example
   * ```typescript
   * const updatedSuite = await testSuitesController.updateTestSuite('project-123', 'suite-456', {
   *   name: 'Updated E2E Tests',
   *   description: 'Updated description'
   * });
   * ```
   */
  @Put(':suiteId')
  @ApiOperation({
    summary: 'Update test suite',
    description: 'Update an existing test suite',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: 'string' })
  @ApiParam({ name: 'suiteId', description: 'Test suite ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Test suite updated successfully',
    type: TestSuiteResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Test suite not found' })
  async updateTestSuite(
    @Param('projectId') projectId: string,
    @Param('suiteId') suiteId: string,
    @Body() dto: UpdateTestSuiteDto,
  ) {
    this.logger.log(`Updating test suite: ${suiteId} for project: ${projectId}`);
    return await this.testSuitesService.updateTestSuite(projectId, suiteId, dto);
  }

  /**
   * Deletes a test suite.
   * 
   * @param projectId - The project ID
   * @param suiteId - The test suite ID
   * @returns Promise<{ success: boolean; message: string }> - Deletion result
   * @throws 404 - Test suite not found
   * 
   * @example
   * ```typescript
   * const result = await testSuitesController.deleteTestSuite('project-123', 'suite-456');
   * console.log(result.message); // "Test suite deleted successfully"
   * ```
   */
  @Delete(':suiteId')
  @ApiOperation({
    summary: 'Delete test suite',
    description: 'Delete a test suite',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: 'string' })
  @ApiParam({ name: 'suiteId', description: 'Test suite ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Test suite deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Test suite not found' })
  async deleteTestSuite(
    @Param('projectId') projectId: string,
    @Param('suiteId') suiteId: string,
  ) {
    this.logger.log(`Deleting test suite: ${suiteId} for project: ${projectId}`);
    return await this.testSuitesService.deleteTestSuite(projectId, suiteId);
  }

  /**
   * Executes a test suite and runs all its test cases.
   * 
   * @param projectId - The project ID
   * @param suiteId - The test suite ID
   * @param dto - The execution configuration
   * @returns Promise<object> - Execution result with execution ID and status
   * @throws 404 - Test suite not found
   * 
   * @example
   * ```typescript
   * const result = await testSuitesController.executeTestSuite('project-123', 'suite-456', {
   *   environment: 'staging',
   *   parallel: true
   * });
   * console.log(result.data.executionId); // "exec-789"
   * ```
   */
  @Post(':suiteId/execute')
  @ApiOperation({
    summary: 'Execute test suite',
    description: 'Execute a test suite and run all its test cases',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: 'string' })
  @ApiParam({ name: 'suiteId', description: 'Test suite ID', type: 'string' })
  @ApiResponse({
    status: 202,
    description: 'Test suite execution started',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            executionId: { type: 'string' },
            status: { type: 'string' },
            message: { type: 'string' },
            startedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Test suite not found' })
  async executeTestSuite(
    @Param('projectId') projectId: string,
    @Param('suiteId') suiteId: string,
    @Body() dto: ExecuteTestSuiteDto,
  ) {
    this.logger.log(`Executing test suite: ${suiteId} for project: ${projectId}`);
    return await this.testSuitesService.executeTestSuite(projectId, suiteId, dto);
  }

  /**
   * Gets execution history for a specific test suite.
   * 
   * @param projectId - The project ID
   * @param suiteId - The test suite ID
   * @returns Promise<object[]> - Array of execution history records
   * @throws 404 - Test suite not found
   * 
   * @example
   * ```typescript
   * const history = await testSuitesController.getExecutionHistory('project-123', 'suite-456');
   * console.log(`Found ${history.length} executions`);
   * ```
   */
  @Get(':suiteId/execution-history')
  @ApiOperation({
    summary: 'Get test suite execution history',
    description: 'Get execution history for a specific test suite',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: 'string' })
  @ApiParam({ name: 'suiteId', description: 'Test suite ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Execution history retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Test suite not found' })
  async getExecutionHistory(
    @Param('projectId') projectId: string,
    @Param('suiteId') suiteId: string,
  ) {
    this.logger.log(`Getting execution history for test suite: ${suiteId}`);
    return await this.testSuitesService.getExecutionHistory(projectId, suiteId);
  }

  /**
   * Gets all test sets for a specific section to use in test plans.
   * 
   * @param projectId - The project ID
   * @param section - The section name
   * @returns Promise<TestSuiteResponseDto[]> - Array of test sets for the section
   * 
   * @example
   * ```typescript
   * const testSets = await testSuitesController.getTestSetsBySection('project-123', 'ecommerce');
   * console.log(`Found ${testSets.length} test sets for ecommerce section`);
   * ```
   */
  @Get('test-sets/:section')
  @ApiOperation({
    summary: 'Get test sets by section for test plans',
    description: 'Get all test sets for a specific section to use in test plans',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: 'string' })
  @ApiParam({ name: 'section', description: 'Section name', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Test sets retrieved successfully',
  })
  async getTestSetsBySection(
    @Param('projectId') projectId: string,
    @Param('section') section: string,
  ) {
    this.logger.log(`Getting test sets for section: ${section} in project: ${projectId}`);
    return await this.testSuitesService.getTestSetsBySection(projectId, section);
  }
}
