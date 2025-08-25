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

@ApiTags('test-suites')
@Controller('projects/:projectId/test-suites')
export class TestSuitesController {
  private readonly logger = new Logger(TestSuitesController.name);

  constructor(private readonly testSuitesService: TestSuitesService) {}

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
