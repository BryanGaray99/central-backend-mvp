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
import { TestCasesService } from '../services/test-cases.service';
import { StepTemplatesService } from '../services/step-templates.service';
import { TestStepRegistrationService } from '../services/test-step-registration.service';
import { CreateTestCaseDto } from '../dto/create-test-case.dto';
import { UpdateTestCaseDto } from '../dto/update-test-case.dto';
import { TestCaseResponseDto } from '../dto/test-case-response.dto';
import { TestCaseFiltersDto } from '../dto/test-case-filters.dto';
import { TestCaseStatisticsDto } from '../dto/test-case-statistics.dto';
import { TestStepResponseDto } from '../dto/step-template-response.dto';
import { TestCaseGenerationService } from '../../ai/services/test-case-generation.service';
import { AIGenerationRequest, AIGenerationResponse } from '../../ai/interfaces/ai-agent.interface';
import { AIGenerationRequestDto } from '../../ai/dto/ai-generation-request.dto';
import { CommonHooksRegistrationService } from '../services/common-hooks-registration.service';

/**
 * Interface for test case list response structure.
 *
 * @interface TestCaseListResponseDto
 * @since 1.0.0
 */
interface TestCaseListResponseDto {
  /**
   * Array of test cases.
   */
  testCases: TestCaseResponseDto[];

  /**
   * Pagination information.
   */
  pagination: {
    /** Current page number */
    page: number;
    /** Number of items per page */
    limit: number;
    /** Total number of items */
    total: number;
    /** Total number of pages */
    totalPages: number;
  };

  /**
   * Applied filters.
   */
  filters: TestCaseFiltersDto;
}

/**
 * Project Test Cases Controller
 *
 * This controller handles HTTP requests related to test case management within specific projects.
 * It provides endpoints for creating, reading, updating, and deleting test cases, as well as
 * managing step templates and AI-powered test generation.
 *
 * @class ProjectTestCasesController
 * @since 1.0.0
 */
@ApiTags('test-cases')
@Controller('projects/:projectId/test-cases')
export class ProjectTestCasesController {
  private readonly logger = new Logger(ProjectTestCasesController.name);

  constructor(
    private readonly testCasesService: TestCasesService,
    private readonly stepTemplatesService: StepTemplatesService,
    private readonly testStepRegistrationService: TestStepRegistrationService,
    private readonly testCaseGenerationService: TestCaseGenerationService,
    private readonly commonHooksRegistrationService: CommonHooksRegistrationService,
  ) {}

  /**
   * Creates a new test case for the specified project.
   *
   * This endpoint allows creating a new test case with all necessary information
   * including scenario, hooks, metadata, and step definitions.
   *
   * @param projectId - The ID of the project to create the test case in
   * @param dto - The test case creation data
   * @returns Promise resolving to the created test case response
   *
   * @example
   * ```typescript
   * const testCase = await controller.createTestCase('project-123', {
   *   name: 'Create Product Test',
   *   description: 'Test product creation',
   *   entityName: 'Product',
   *   section: 'ecommerce',
   *   method: 'POST',
   *   scenario: 'Given I have valid data\nWhen I create a product\nThen it should be created'
   * });
   * ```
   */
  @Post()
  @ApiOperation({
    summary: 'Create a new test case',
    description: 'Create a new test case for the specified project',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({
    status: 201,
    description: 'Test case created successfully',
    type: TestCaseResponseDto,
  })
  async createTestCase(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTestCaseDto,
  ): Promise<TestCaseResponseDto> {
    return this.testCasesService.createTestCase(projectId, dto);
  }

  /**
   * Lists all test cases for the specified project with optional filtering and pagination.
   *
   * This endpoint retrieves test cases with support for various filters including
   * entity name, section, method, test type, status, and search terms. Results
   * are paginated and can be sorted by different fields.
   *
   * @param projectId - The ID of the project to list test cases from
   * @param filters - Optional filters and pagination parameters
   * @returns Promise resolving to paginated test case list with applied filters
   *
   * @example
   * ```typescript
   * const result = await controller.listTestCases('project-123', {
   *   entityName: 'Product',
   *   testType: 'positive',
   *   page: 1,
   *   limit: 20
   * });
   * ```
   */
  @Get()
  @ApiOperation({
    summary: 'List test cases',
    description: 'List all test cases for the specified project with optional filters',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiQuery({ name: 'entityName', required: false })
  @ApiQuery({ name: 'section', required: false })
  @ApiQuery({ name: 'method', required: false })
  @ApiQuery({ name: 'testType', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'tags', required: false, type: [String] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  @ApiResponse({
    status: 200,
    description: 'Test cases retrieved successfully',
  })
  async listTestCases(
    @Param('projectId') projectId: string,
    @Query() filters: TestCaseFiltersDto,
  ): Promise<TestCaseListResponseDto> {
    const result = await this.testCasesService.listTestCases(projectId, filters);
    return result;
  }

  /**
   * Gets statistics for test cases in the specified project.
   *
   * This endpoint provides comprehensive statistics about test cases including
   * counts by type, status, and performance metrics.
   *
   * @param projectId - The ID of the project to get statistics for
   * @returns Promise resolving to test case statistics
   *
   * @example
   * ```typescript
   * const stats = await controller.getStatistics('project-123');
   * console.log(stats.totalCases); // Total number of test cases
   * console.log(stats.positiveCases); // Number of positive test cases
   * ```
   */
  @Get('statistics')
  @ApiOperation({
    summary: 'Get test case statistics',
    description: 'Get statistics for test cases in the specified project',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    type: TestCaseStatisticsDto,
  })
  async getStatistics(
    @Param('projectId') projectId: string,
  ): Promise<TestCaseStatisticsDto> {
    return this.testCasesService.getStatistics(projectId);
  }


  /**
   * Gets details of a specific test case by ID.
   *
   * This endpoint retrieves complete information about a specific test case
   * including its scenario, hooks, metadata, and execution history.
   *
   * @param projectId - The ID of the project containing the test case
   * @param testCaseId - The ID of the test case to retrieve
   * @returns Promise resolving to the test case details
   *
   * @example
   * ```typescript
   * const testCase = await controller.getTestCase('project-123', 'TC-ECOMMERCE-01');
   * ```
   */
  @Get(':testCaseId')
  @ApiOperation({
    summary: 'Get a specific test case',
    description: 'Get details of a specific test case by ID',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'testCaseId', description: 'Test case ID' })
  @ApiResponse({
    status: 200,
    description: 'Test case retrieved successfully',
    type: TestCaseResponseDto,
  })
  async getTestCase(
    @Param('projectId') projectId: string,
    @Param('testCaseId') testCaseId: string,
  ): Promise<TestCaseResponseDto> {
    return this.testCasesService.findByTestCaseId(testCaseId);
  }

  /**
   * Updates an existing test case.
   *
   * This endpoint allows partial updates of test case information including
   * name, description, scenario, hooks, and metadata.
   *
   * @param projectId - The ID of the project containing the test case
   * @param testCaseId - The ID of the test case to update
   * @param dto - The update data for the test case
   * @returns Promise resolving to the updated test case
   *
   * @example
   * ```typescript
   * const updated = await controller.updateTestCase('project-123', 'TC-ECOMMERCE-01', {
   *   name: 'Updated Test Case Name',
   *   description: 'Updated description'
   * });
   * ```
   */
  @Put(':testCaseId')
  @ApiOperation({
    summary: 'Update a test case',
    description: 'Update an existing test case',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'testCaseId', description: 'Test case ID' })
  @ApiResponse({
    status: 200,
    description: 'Test case updated successfully',
    type: TestCaseResponseDto,
  })
  async updateTestCase(
    @Param('projectId') projectId: string,
    @Param('testCaseId') testCaseId: string,
    @Body() dto: UpdateTestCaseDto,
  ): Promise<TestCaseResponseDto> {
    return this.testCasesService.updateTestCase(testCaseId, dto);
  }

  /**
   * Updates test case steps with organized step selection.
   *
   * This endpoint allows updating test case steps with a structured approach,
   * including tags, step definitions, and scenario text.
   *
   * @param projectId - The ID of the project containing the test case
   * @param testCaseId - The ID of the test case to update
   * @param dto - The step update data including tags, steps, and scenario
   * @returns Promise resolving to the updated test case
   *
   * @example
   * ```typescript
   * const updated = await controller.updateTestCaseSteps('project-123', 'TC-ECOMMERCE-01', {
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
  @Put(':testCaseId/steps')
  @ApiOperation({ 
    summary: 'Update test case steps with organized step selection',
    description: 'Update test case with new steps, tags, and scenario structure'
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'testCaseId', description: 'Test case ID' })
  @ApiResponse({
    status: 200,
    description: 'Test case steps updated successfully',
    type: TestCaseResponseDto,
  })
  async updateTestCaseSteps(
    @Param('projectId') projectId: string,
    @Param('testCaseId') testCaseId: string,
    @Body() dto: {
      tags: string[];
      steps: {
        type: 'Given' | 'When' | 'Then' | 'And';
        stepId: string;
        parameters?: Record<string, any>;
      }[];
      scenario: string;
    },
  ): Promise<TestCaseResponseDto> {
    this.logger.log(`[CONTROLLER] Updating test case steps: ${testCaseId}`);
    this.logger.log(`[CONTROLLER] ProjectId: ${projectId}`);
    this.logger.log(`[CONTROLLER] Steps DTO: ${JSON.stringify(dto, null, 2)}`);
    
    return await this.testCasesService.updateTestCaseSteps(projectId, testCaseId, dto);
  }

  /**
   * Updates test case scenario with complete text.
   *
   * This endpoint allows updating the complete scenario text of a test case
   * including tags and the full Gherkin scenario.
   *
   * @param projectId - The ID of the project containing the test case
   * @param testCaseId - The ID of the test case to update
   * @param dto - The scenario update data including tags and scenario text
   * @returns Promise resolving to the updated test case
   *
   * @example
   * ```typescript
   * const updated = await controller.updateTestCaseScenario('project-123', 'TC-ECOMMERCE-01', {
   *   tags: ['@smoke', '@api'],
   *   scenario: 'Given I have valid product data\nWhen I send a POST request\nThen the product should be created successfully'
   * });
   * ```
   */
  @Put(':testCaseId/scenario')
  @ApiOperation({ 
    summary: 'Update test case scenario with complete text',
    description: 'Update test case with complete scenario text including tags and steps'
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'testCaseId', description: 'Test case ID' })
  @ApiResponse({
    status: 200,
    description: 'Test case scenario updated successfully',
    type: TestCaseResponseDto,
  })
  async updateTestCaseScenario(
    @Param('projectId') projectId: string,
    @Param('testCaseId') testCaseId: string,
    @Body() dto: {
      tags: string[];
      scenario: string;
    },
  ): Promise<TestCaseResponseDto> {
    this.logger.log(`[CONTROLLER] Updating test case scenario: ${testCaseId}`);
    this.logger.log(`[CONTROLLER] ProjectId: ${projectId}`);
    this.logger.log(`[CONTROLLER] Scenario DTO: ${JSON.stringify(dto, null, 2)}`);
    
    return await this.testCasesService.updateTestCaseScenario(projectId, testCaseId, dto);
  }

  /**
   * Deletes a test case by ID.
   *
   * This endpoint permanently removes a test case and all its associated data
   * including execution history and metadata.
   *
   * @param projectId - The ID of the project containing the test case
   * @param testCaseId - The ID of the test case to delete
   * @returns Promise resolving to a success message
   *
   * @example
   * ```typescript
   * const result = await controller.deleteTestCase('project-123', 'TC-ECOMMERCE-01');
   * console.log(result.message); // 'Test case deleted successfully'
   * ```
   */
  @Delete(':testCaseId')
  @ApiOperation({
    summary: 'Delete a test case',
    description: 'Delete a test case by ID',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'testCaseId', description: 'Test case ID' })
  @ApiResponse({
    status: 200,
    description: 'Test case deleted successfully',
  })
  async deleteTestCase(
    @Param('projectId') projectId: string,
    @Param('testCaseId') testCaseId: string,
  ): Promise<{ message: string }> {
    await this.testCasesService.deleteTestCase(testCaseId);
    return { message: 'Test case deleted successfully' };
  }


  /**
   * Gets step templates organized by type and category.
   *
   * This endpoint retrieves step templates organized by Gherkin types (Given/When/Then)
   * and categories (common vs entity-specific steps) for easy selection in test case creation.
   *
   * @param projectId - The ID of the project to get step templates for
   * @returns Promise resolving to organized step templates
   *
   * @example
   * ```typescript
   * const templates = await controller.getOrganizedStepTemplates('project-123');
   * console.log(templates.Given.common); // Common Given steps
   * console.log(templates.When.entity); // Entity-specific When steps
   * ```
   */
  @Get('step-templates/organized')
  @ApiOperation({ 
    summary: 'Get step templates organized by type and category',
    description: 'Get step templates organized by Given/When/Then with common and entity-specific steps'
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Step templates organized successfully',
    schema: {
      type: 'object',
      properties: {
        Given: {
          type: 'object',
          properties: {
            common: { type: 'array', items: { $ref: '#/components/schemas/TestStepResponseDto' } },
            entity: { type: 'array', items: { $ref: '#/components/schemas/TestStepResponseDto' } }
          }
        },
        When: {
          type: 'object',
          properties: {
            common: { type: 'array', items: { $ref: '#/components/schemas/TestStepResponseDto' } },
            entity: { type: 'array', items: { $ref: '#/components/schemas/TestStepResponseDto' } }
          }
        },
        Then: {
          type: 'object',
          properties: {
            common: { type: 'array', items: { $ref: '#/components/schemas/TestStepResponseDto' } },
            entity: { type: 'array', items: { $ref: '#/components/schemas/TestStepResponseDto' } }
          }
        }
      }
    }
  })
  async getOrganizedStepTemplates(
    @Param('projectId') projectId: string,
  ): Promise<{
    Given: { common: TestStepResponseDto[]; entity: TestStepResponseDto[] };
    When: { common: TestStepResponseDto[]; entity: TestStepResponseDto[] };
    Then: { common: TestStepResponseDto[]; entity: TestStepResponseDto[] };
  }> {
    return await this.stepTemplatesService.getOrganizedStepTemplates(projectId);
  }

  /**
   * Generates test cases using AI for the specified project.
   *
   * This endpoint uses AI to automatically generate test cases based on the provided
   * requirements, entity information, and operation details.
   *
   * @param projectId - The ID of the project to generate test cases for
   * @param request - The AI generation request with requirements and metadata
   * @returns Promise resolving to AI generation response with generated test cases
   *
   * @example
   * ```typescript
   * const result = await controller.generateWithAI('project-123', {
   *   entityName: 'Product',
   *   section: 'ecommerce',
   *   operation: 'create',
   *   requirements: 'Test product creation with valid and invalid data'
   * });
   * ```
   */
  @Post('ai/generate')
  @ApiOperation({
    summary: 'Generate test cases with AI',
    description: 'Generate new test cases using AI for the specified project',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({
    status: 201,
    description: 'Test cases generated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object' },
        error: { type: 'string' },
        metadata: { type: 'object' },
      },
    },
  })
  async generateWithAI(
    @Param('projectId') projectId: string,
    @Body() request: AIGenerationRequestDto,
  ): Promise<AIGenerationResponse> {
    this.logger.log(`🎯 [CONTROLLER] Received request to generate tests with AI`);
    this.logger.log(`📋 [CONTROLLER] ProjectId: ${projectId}`);
    this.logger.log(`📋 [CONTROLLER] Request body: ${JSON.stringify(request, null, 2)}`);
    
    // Convert DTO to interface
    const aiRequest: AIGenerationRequest = {
      projectId,
      entityName: request.entityName,
      section: request.section,
      operation: request.operation,
      requirements: request.requirements,
      metadata: request.metadata,
    };
    
    this.logger.log(`🔄 [CONTROLLER] Sending request to TestCaseGenerationService...`);
    const result = await this.testCaseGenerationService.generateTestCases(aiRequest);
    this.logger.log(`✅ [CONTROLLER] Response received from TestCaseGenerationService: ${JSON.stringify(result, null, 2)}`);
    
    return result;
  }

} 