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
    this.logger.log(`[CONTROLLER] Actualizando steps del test case: ${testCaseId}`);
    this.logger.log(`[CONTROLLER] ProjectId: ${projectId}`);
    this.logger.log(`[CONTROLLER] Steps DTO: ${JSON.stringify(dto, null, 2)}`);
    
    return await this.testCasesService.updateTestCaseSteps(projectId, testCaseId, dto);
  }

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
    this.logger.log(`[CONTROLLER] Actualizando scenario del test case: ${testCaseId}`);
    this.logger.log(`[CONTROLLER] ProjectId: ${projectId}`);
    this.logger.log(`[CONTROLLER] Scenario DTO: ${JSON.stringify(dto, null, 2)}`);
    
    return await this.testCasesService.updateTestCaseScenario(projectId, testCaseId, dto);
  }

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
    this.logger.log(`🎯 [CONTROLLER] Recibido request para generar tests con IA`);
    this.logger.log(`📋 [CONTROLLER] ProjectId: ${projectId}`);
    this.logger.log(`📋 [CONTROLLER] Request body: ${JSON.stringify(request, null, 2)}`);
    
    // Convertir DTO a interface
    const aiRequest: AIGenerationRequest = {
      projectId,
      entityName: request.entityName,
      section: request.section,
      operation: request.operation,
      requirements: request.requirements,
      metadata: request.metadata,
    };
    
    this.logger.log(`🔄 [CONTROLLER] Enviando request al TestCaseGenerationService...`);
    const result = await this.testCaseGenerationService.generateTestCases(aiRequest);
    this.logger.log(`✅ [CONTROLLER] Respuesta recibida del TestCaseGenerationService: ${JSON.stringify(result, null, 2)}`);
    
    return result;
  }

} 