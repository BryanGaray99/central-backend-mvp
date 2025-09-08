import {
  Controller,
  Get,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TestCasesService } from '../services/test-cases.service';

/**
 * Test Cases Controller
 *
 * This controller handles HTTP requests related to test case management across all projects.
 * It provides endpoints for listing all registered test cases from all projects in the system.
 *
 * @class TestCasesController
 * @since 1.0.0
 */
@ApiTags('test-cases')
@Controller('test-cases')
export class TestCasesController {
  private readonly logger = new Logger(TestCasesController.name);

  constructor(private readonly testCasesService: TestCasesService) {}

  /**
   * Lists all registered test cases across all projects.
   *
   * This endpoint retrieves all test cases from all projects in the system,
   * providing a comprehensive view of all registered test cases with their
   * basic information and metadata.
   *
   * @returns Promise resolving to an array of test case response DTOs
   *
   * @example
   * ```typescript
   * const allTestCases = await controller.listAllTestCases();
   * console.log(`Total test cases: ${allTestCases.length}`);
   * ```
   */
  @Get()
  @ApiOperation({
    summary: 'List all registered test cases across all projects',
    description: 'Gets the list of all registered test cases from all projects.',
  })
  @ApiResponse({
    status: 200,
    description: 'All test cases retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              testCaseId: {
                type: 'string',
                description: 'Unique test case ID (UUID)',
              },
              testCaseIdName: {
                type: 'string',
                description: 'Unique test case ID Name',
              },
              name: {
                type: 'string',
                description: 'Descriptive name of the test case',
              },
              entityName: { type: 'string' },
              section: { type: 'string' },
              method: { type: 'string' },
              testType: { type: 'string' },
              scenario: { type: 'string' },
              status: { type: 'string' },
              projectId: { type: 'string' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
              tags: { 
                type: 'array', 
                items: { type: 'string' } 
              },
              hooks: { type: 'object' },
              examples: { type: 'object' },
        metadata: { type: 'object' },
            },
          },
        },
      },
    },
  })
  async listAllTestCases() {
    const testCases = await this.testCasesService.listAllTestCases();
      
    return testCases.map((testCase) => this.testCasesService.toTestCaseResponseDto(testCase));
  }
} 