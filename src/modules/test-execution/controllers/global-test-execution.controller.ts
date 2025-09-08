import {
  Controller,
  Get,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TestExecutionService } from '../services/test-execution.service';

/**
 * Global Test Execution Controller
 *
 * Exposes project-agnostic endpoints to retrieve aggregated test execution
 * information across all projects.
 *
 * @since 1.0.0
 */
@ApiTags('test-execution')
@Controller('test-execution')
export class GlobalTestExecutionController {
  private readonly logger = new Logger(GlobalTestExecutionController.name);

  constructor(private readonly testExecutionService: TestExecutionService) {}

  /**
   * Retrieves the global test execution summary for all projects.
   *
   * @returns A global statistical summary of all executions across projects.
   */
  @Get('summary')
  @ApiOperation({
    summary: 'Get global summary of all executions',
    description: 'Retrieves statistical summary across executions of all projects',
  })
  @ApiResponse({
    status: 200,
    description: 'Global summary retrieved successfully',
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
  async getGlobalExecutionSummary() {
    const summary = await this.testExecutionService.getGlobalExecutionSummary();

    return summary;
  }
} 