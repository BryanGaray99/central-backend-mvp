import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  Query,
  Logger,
  Res,
  Sse,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { TestExecutionService } from '../services/test-execution.service';
import { ExecuteTestsDto } from '../dto/execute-tests.dto';
import { ExecutionFiltersDto } from '../dto/execution-filters.dto';

/**
 * Test Execution Controller
 *
 * Provides project-scoped endpoints to execute tests, retrieve execution results,
 * list past executions, and stream real-time execution events.
 *
 * @since 1.0.0
 */
@ApiTags('test-execution')
@Controller('projects/:projectId/test-execution')
export class TestExecutionController {
  private readonly logger = new Logger(TestExecutionController.name);

  constructor(private readonly testExecutionService: TestExecutionService) {}

  /**
   * Executes tests for a project with optional filters.
   *
   * Starts an asynchronous execution and returns a brief receipt with execution info.
   *
   * @param projectId - Project identifier
   * @param dto - Execution configuration and filters
   */
  @Post('execute')
  @ApiOperation({
    summary: 'Execute test cases',
    description: 'Executes test cases for a specific entity with optional filters',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: 'string' })
  @ApiResponse({
    status: 202,
    description: 'Execution started successfully',
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
            testCasesToUpdate: { type: 'number' },
            entityName: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or entity without test cases',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async executeTests(
    @Param('projectId') projectId: string,
    @Body() dto: ExecuteTestsDto,
  ) {
    const entityName = dto.entityName || 'all test cases';
    this.logger.log(`[CONTROLLER] Executing tests for entity: ${entityName} in project: ${projectId}`);

    return await this.testExecutionService.executeTests(projectId, dto);
  }

  /**
   * Retrieves detailed results for a specific execution.
   *
   * @param projectId - Project identifier
   * @param executionId - Execution identifier
   */
  @Get('results/:executionId')
  @ApiOperation({
    summary: 'Get results for a specific execution',
    description: 'Obtains detailed results for a test execution',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: 'string' })
  @ApiParam({ name: 'executionId', description: 'Execution ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Results retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            executionId: { type: 'string' },
            status: { type: 'string' },
            startedAt: { type: 'string', format: 'date-time' },
            completedAt: { type: 'string', format: 'date-time' },
            executionTime: { type: 'number' },
            summary: {
              type: 'object',
              properties: {
                totalScenarios: { type: 'number' },
                passedScenarios: { type: 'number' },
                failedScenarios: { type: 'number' },
                skippedScenarios: { type: 'number' },
                successRate: { type: 'number' },
                averageDuration: { type: 'number' },
                totalDuration: { type: 'number' },
                startTime: { type: 'string', format: 'date-time' },
                endTime: { type: 'string', format: 'date-time' },
              },
            },
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  scenarioName: { type: 'string' },
                  scenarioTags: { type: 'array', items: { type: 'string' } },
                  status: { type: 'string' },
                  duration: { type: 'number' },
                  steps: {
                    type: 'array',
                    items: {
                      type: 'object',
                                              properties: {
                          stepName: { type: 'string' },
                          status: { type: 'string' },
                          duration: { type: 'number' },
                          errorMessage: { type: 'string' },
                          timestamp: { type: 'string', format: 'date-time' },
                          isHook: { type: 'boolean' },
                          hookType: { type: 'string' },
                        },
                    },
                  },
                  errorMessage: { type: 'string' },
                  metadata: {
                    type: 'object',
                    properties: {
                      feature: { type: 'string' },
                      tags: { type: 'array', items: { type: 'string' } },
                      scenarioId: { type: 'string' },
                      line: { type: 'number' },
                    },
                  },
                  stepCount: { type: 'number' },
                  passedSteps: { type: 'number' },
                  failedSteps: { type: 'number' },
                  skippedSteps: { type: 'number' },
                  actualStepCount: { type: 'number' },
                  passedActualSteps: { type: 'number' },
                  failedActualSteps: { type: 'number' },
                  successRate: { type: 'number' },
                  actualSuccessRate: { type: 'number' },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
            metadata: { type: 'object' },
            errorMessage: { type: 'string' },
            entityName: { type: 'string' },
            method: { type: 'string' },
            testType: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            specificScenario: { type: 'string' },
            totalScenarios: { type: 'number' },
            passedScenarios: { type: 'number' },
            failedScenarios: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  async getResults(
    @Param('projectId') projectId: string,
    @Param('executionId') executionId: string,
  ) {
    this.logger.log(`[CONTROLLER] Getting execution results: ${executionId}`);

    return await this.testExecutionService.getResults(executionId);
  }

  /**
   * Lists execution results for a project with optional filters.
   *
   * @param projectId - Project identifier
   * @param filters - Optional query filters
   */
  @Get('results')
  @ApiOperation({
    summary: 'List execution results',
    description: 'Retrieves a list of executions with optional filters',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: 'string' })
  @ApiQuery({ name: 'entityName', required: false, description: 'Filter by entity' })
  @ApiQuery({ name: 'method', required: false, description: 'Filter by HTTP method' })
  @ApiQuery({ name: 'testType', required: false, description: 'Filter by test type' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Start date (ISO string)' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'End date (ISO string)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', type: 'number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Execution list retrieved successfully',
  })
  async listResults(
    @Param('projectId') projectId: string,
    @Query() filters: ExecutionFiltersDto,
  ) {
    const results = await this.testExecutionService.listResults(projectId, filters);

    return results;
  }

  /**
   * Deletes all results for a specific execution.
   *
   * @param projectId - Project identifier
   * @param executionId - Execution identifier
   */
  @Delete('results/:executionId')
  @ApiOperation({
    summary: 'Delete execution results',
    description: 'Deletes the results of a specific execution',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: 'string' })
  @ApiParam({ name: 'executionId', description: 'Execution ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Results deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  async deleteResults(
    @Param('projectId') projectId: string,
    @Param('executionId') executionId: string,
  ) {
    this.logger.log(`[CONTROLLER] Deleting execution results: ${executionId}`);

    await this.testExecutionService.deleteResults(executionId);

    return { message: 'Execution results deleted successfully' };
  }

  /**
   * Retrieves the execution history for a specific entity within a project.
   *
   * @param projectId - Project identifier
   * @param entityName - Entity name
   */
  @Get('history/:entityName')
  @ApiOperation({
    summary: 'Get execution history by entity',
    description: 'Gets the execution history for a specific entity',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: 'string' })
  @ApiParam({ name: 'entityName', description: 'Entity name', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'History retrieved successfully',
  })
  async getExecutionHistory(
    @Param('projectId') projectId: string,
    @Param('entityName') entityName: string,
  ) {
    this.logger.log(`[CONTROLLER] Getting history for entity: ${entityName}`);

    return await this.testExecutionService.getExecutionHistory(
      projectId,
      entityName,
    );
  }

  /**
   * Retrieves a summary of all executions for the project.
   *
   * @param projectId - Project identifier
   */
  @Get('summary')
  @ApiOperation({
    summary: 'Get project execution summary',
    description: 'Retrieves a statistical summary of all project executions',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Summary retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            totalExecutions: { type: 'number' },
            totalScenarios: { type: 'number' },
            totalPassed: { type: 'number' },
            totalFailed: { type: 'number' },
            successRate: { type: 'number' },
            averageExecutionTime: { type: 'number' },
            statusDistribution: { type: 'object' },
            lastExecution: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  async getExecutionSummary(@Param('projectId') projectId: string) {
    this.logger.log(`[CONTROLLER] Getting execution summary for project: ${projectId}`);

    return await this.testExecutionService.getExecutionSummary(projectId);
  }

  /**
   * Server-Sent Events endpoint to stream real-time execution events.
   *
   * @param projectId - Project identifier
   */
  @Sse('execution-events')
  @ApiOperation({
    summary: 'Server-Sent Events for executions',
    description: 'SSE endpoint for real-time execution events',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: 'string' })
  async executionEvents(@Param('projectId') projectId: string) {
    this.logger.log(`[CONTROLLER] SSE client connected for project: ${projectId}`);

    return this.testExecutionService.getExecutionEvents(projectId);
  }

  /**
   * Retrieves the last execution for a given test suite.
   *
   * @param projectId - Project identifier
   * @param testSuiteId - Test suite identifier
   */
  @Get('last-execution/test-suite/:testSuiteId')
  @ApiOperation({
    summary: 'Get the last execution for a test suite',
    description: 'Retrieves the most recent execution associated with a specific test suite',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: 'string' })
  @ApiParam({ name: 'testSuiteId', description: 'Test suite ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Last execution retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        executionId: { type: 'string' },
        status: { type: 'string' },
        startedAt: { type: 'string', format: 'date-time' },
        completedAt: { type: 'string', format: 'date-time' },
        executionTime: { type: 'number' },
        totalScenarios: { type: 'number' },
        passedScenarios: { type: 'number' },
        failedScenarios: { type: 'number' },
        entityName: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'No execution found for test suite' })
  async getLastExecutionByTestSuite(
    @Param('projectId') projectId: string,
    @Param('testSuiteId') testSuiteId: string,
  ) {
    this.logger.log(`[CONTROLLER] Getting last execution for test suite: ${testSuiteId} in project: ${projectId}`);

    return await this.testExecutionService.getLastExecutionByTestSuite(projectId, testSuiteId);
  }

  /**
   * Retrieves the last execution for a given test case.
   *
   * @param projectId - Project identifier
   * @param testCaseId - Test case identifier
   */
  @Get('last-execution/test-case/:testCaseId')
  @ApiOperation({
    summary: 'Get the last execution for a test case',
    description: 'Retrieves the most recent execution associated with a specific test case',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: 'string' })
  @ApiParam({ name: 'testCaseId', description: 'Test case ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Last execution retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        executionId: { type: 'string' },
        status: { type: 'string' },
        startedAt: { type: 'string', format: 'date-time' },
        completedAt: { type: 'string', format: 'date-time' },
        executionTime: { type: 'number' },
        totalScenarios: { type: 'number' },
        passedScenarios: { type: 'number' },
        failedScenarios: { type: 'number' },
        entityName: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'No execution found for test case' })
  async getLastExecutionByTestCase(
    @Param('projectId') projectId: string,
    @Param('testCaseId') testCaseId: string,
  ) {
    this.logger.log(`[CONTROLLER] Getting last execution for test case: ${testCaseId} in project: ${projectId}`);

    return await this.testExecutionService.getLastExecutionByTestCase(projectId, testCaseId);
  }

  /**
   * Retrieves the failed executions for a given test case ID.
   *
   * @param projectId - Project identifier
   * @param testCaseId - Test case identifier
   */
  @Get('failed-executions/:testCaseId')
  @ApiOperation({
    summary: 'Get failed executions by test case ID',
    description: 'Obtains failed executions associated with a specific test case',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: 'string' })
  @ApiParam({ name: 'testCaseId', description: 'Test case ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Failed executions retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          executionId: { type: 'string' },
          testCaseId: { type: 'string' },
          testCaseName: { type: 'string' },
          entityName: { type: 'string' },
          section: { type: 'string' },
          method: { type: 'string' },
          endpoint: { type: 'string' },
          errorMessage: { type: 'string' },
          executionDate: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  async getFailedExecutionsByTestCaseId(
    @Param('projectId') projectId: string,
    @Param('testCaseId') testCaseId: string,
  ) {
    this.logger.log(`[CONTROLLER] Getting failed executions for test case: ${testCaseId} in project: ${projectId}`);

    return await this.testExecutionService.getFailedExecutionsByTestCaseId(projectId, testCaseId);
  }
} 