import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { TestCasesService } from '../services/test-cases.service';
import { StepTemplatesService } from '../services/step-templates.service';
import { CreateTestCaseDto } from '../dto/create-test-case.dto';
import { UpdateTestCaseDto } from '../dto/update-test-case.dto';
import { TestCaseResponseDto } from '../dto/test-case-response.dto';
import { TestCaseFiltersDto } from '../dto/test-case-filters.dto';
import { TestCaseStatisticsDto } from '../dto/test-case-statistics.dto';
import { CreateStepDto } from '../dto/create-step.dto';
import { TestStepResponseDto } from '../dto/step-template-response.dto';

// Interfaces temporales para los métodos TODO
interface StepTemplateStatisticsDto {
  totalSteps: number;
  activeSteps: number;
  deprecatedSteps: number;
  mostUsedSteps: Array<{
    stepId: string;
    name: string;
    usageCount: number;
  }>;
  lastUpdated: Date;
}

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
export class TestCasesController {
  private readonly logger = new Logger(TestCasesController.name);

  constructor(
    private readonly testCasesService: TestCasesService,
    private readonly stepTemplatesService: StepTemplatesService,
  ) {}

  // ✅ MÉTODOS CRUD BÁSICOS EN USO
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
    return this.testCasesService.listTestCases(projectId, filters);
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

  // TODO: FUTURA IMPLEMENTACIÓN CON IA - Exportar test case
  @Get(':testCaseId/export')
  @ApiOperation({
    summary: 'Export test case',
    description: 'Export a test case in a specific format',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'testCaseId', description: 'Test case ID' })
  @ApiResponse({
    status: 200,
    description: 'Test case exported successfully',
  })
  async exportTestCase(
    @Param('projectId') projectId: string,
    @Param('testCaseId') testCaseId: string,
  ) {
    // TODO: Implementar con IA para exportación inteligente
    throw new Error('TODO: Implementar con IA - exportTestCase');
  }

  // TODO: FUTURA IMPLEMENTACIÓN CON IA - Duplicar test case
  @Post(':testCaseId/duplicate')
  @ApiOperation({
    summary: 'Duplicate test case',
    description: 'Duplicate a test case with modifications',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'testCaseId', description: 'Test case ID' })
  @ApiResponse({
    status: 201,
    description: 'Test case duplicated successfully',
    type: TestCaseResponseDto,
  })
  async duplicateTestCase(
    @Param('projectId') projectId: string,
    @Param('testCaseId') testCaseId: string,
    @Body() dto: any,
  ): Promise<TestCaseResponseDto> {
    // TODO: Implementar con IA para duplicación inteligente
    throw new Error('TODO: Implementar con IA - duplicateTestCase');
  }

  // ✅ MÉTODOS DE STEP TEMPLATES EN USO
  @Post('step-templates')
  @ApiOperation({
    summary: 'Create a step template',
    description: 'Create a new step template for the project',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({
    status: 201,
    description: 'Step template created successfully',
    type: TestStepResponseDto,
  })
  async createStepTemplate(
    @Param('projectId') projectId: string,
    @Body() dto: CreateStepDto,
  ): Promise<TestStepResponseDto> {
    return this.stepTemplatesService.createStepTemplate(projectId, dto);
  }

  @Get('step-templates')
  @ApiOperation({
    summary: 'List step templates',
    description: 'List all step templates for the project',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Step templates retrieved successfully',
    type: [TestStepResponseDto],
  })
  async listStepTemplates(
    @Param('projectId') projectId: string,
    @Query() filters: any,
  ): Promise<TestStepResponseDto[]> {
    return this.stepTemplatesService.listStepTemplates(projectId, filters);
  }

  @Get('step-templates/statistics')
  @ApiOperation({
    summary: 'Get step template statistics',
    description: 'Get statistics for step templates in the project',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Step template statistics retrieved successfully',
  })
  async getStepTemplateStatistics(
    @Param('projectId') projectId: string,
  ): Promise<StepTemplateStatisticsDto> {
    return this.stepTemplatesService.getStatistics(projectId);
  }

  @Get('step-templates/:stepId')
  @ApiOperation({
    summary: 'Get a specific step template',
    description: 'Get details of a specific step template by ID',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'stepId', description: 'Step template ID' })
  @ApiResponse({
    status: 200,
    description: 'Step template retrieved successfully',
    type: TestStepResponseDto,
  })
  async getStepTemplate(
    @Param('projectId') projectId: string,
    @Param('stepId') stepId: string,
  ): Promise<TestStepResponseDto> {
    return this.stepTemplatesService.findByStepId(stepId);
  }

  @Put('step-templates/:stepId')
  @ApiOperation({
    summary: 'Update a step template',
    description: 'Update an existing step template',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'stepId', description: 'Step template ID' })
  @ApiResponse({
    status: 200,
    description: 'Step template updated successfully',
    type: TestStepResponseDto,
  })
  async updateStepTemplate(
    @Param('projectId') projectId: string,
    @Param('stepId') stepId: string,
    @Body() dto: CreateStepDto,
  ): Promise<TestStepResponseDto> {
    return this.stepTemplatesService.updateStepTemplate(projectId, stepId, dto);
  }

  @Delete('step-templates/:stepId')
  @ApiOperation({
    summary: 'Delete a step template',
    description: 'Delete a step template by ID',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'stepId', description: 'Step template ID' })
  @ApiResponse({
    status: 200,
    description: 'Step template deleted successfully',
  })
  async deleteStepTemplate(
    @Param('projectId') projectId: string,
    @Param('stepId') stepId: string,
  ): Promise<{ message: string }> {
    await this.stepTemplatesService.deleteStepTemplate(stepId);
    return { message: 'Step template deleted successfully' };
  }

  // TODO: FUTURA IMPLEMENTACIÓN CON IA - Validar step template
  @Get('step-templates/:stepId/validate')
  @ApiOperation({
    summary: 'Validate step template',
    description: 'Validate a step template for correctness',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'stepId', description: 'Step template ID' })
  @ApiResponse({
    status: 200,
    description: 'Step template validation completed',
  })
  async validateStepTemplate(
    @Param('projectId') projectId: string,
    @Param('stepId') stepId: string,
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    // TODO: Implementar con IA para validación inteligente
    throw new Error('TODO: Implementar con IA - validateStepTemplate');
  }

  // TODO: FUTURA IMPLEMENTACIÓN CON IA - Obtener step templates por categoría
  @Get('step-templates/category/:category')
  @ApiOperation({
    summary: 'Get step templates by category',
    description: 'Get step templates filtered by category',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'category', description: 'Category name' })
  @ApiResponse({
    status: 200,
    description: 'Step templates by category retrieved successfully',
    type: [TestStepResponseDto],
  })
  async getStepTemplatesByCategory(
    @Param('projectId') projectId: string,
    @Param('category') category: string,
  ): Promise<TestStepResponseDto[]> {
    // TODO: Implementar con IA para categorización inteligente
    throw new Error('TODO: Implementar con IA - getStepTemplatesByCategory');
  }

  // TODO: FUTURA IMPLEMENTACIÓN CON IA - Obtener step templates por tipo
  @Get('step-templates/type/:type')
  @ApiOperation({
    summary: 'Get step templates by type',
    description: 'Get step templates filtered by type',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'type', description: 'Step type' })
  @ApiResponse({
    status: 200,
    description: 'Step templates by type retrieved successfully',
    type: [TestStepResponseDto],
  })
  async getStepTemplatesByType(
    @Param('projectId') projectId: string,
    @Param('type') type: string,
  ): Promise<TestStepResponseDto[]> {
    // TODO: Implementar con IA para tipificación inteligente
    throw new Error('TODO: Implementar con IA - getStepTemplatesByType');
  }
} 