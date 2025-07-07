import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Logger,
  HttpStatus,
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
import { CreateStepDto } from '../dto/create-step.dto';
import { TestCaseFiltersDto } from '../dto/test-case-filters.dto';
import { TestCaseResponseDto } from '../dto/test-case-response.dto';
import { TestStepResponseDto } from '../dto/step-template-response.dto';
import { TestCaseListResponseDto, TestCaseStatisticsDto, TestCaseExportDto, StepTemplateStatisticsDto } from '../dto/test-case-statistics.dto';
import { DuplicateTestCaseDto } from '../interfaces/test-case.interface';

@Controller('projects/:projectId/test-cases')
@ApiTags('Test Cases')
export class TestCasesController {
  private readonly logger = new Logger(TestCasesController.name);

  constructor(
    private readonly testCasesService: TestCasesService,
    private readonly stepTemplatesService: StepTemplatesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo caso de prueba' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Test case creado exitosamente',
    type: TestCaseResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Datos inválidos o steps no encontrados',
  })
  async createTestCase(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTestCaseDto,
  ): Promise<TestCaseResponseDto> {
    this.logger.log(`Creating test case for project ${projectId}`);
    return this.testCasesService.createTestCase(projectId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar casos de prueba con filtros' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de test cases',
    type: TestCaseListResponseDto,
  })
  async listTestCases(
    @Param('projectId') projectId: string,
    @Query() filters: TestCaseFiltersDto,
  ): Promise<TestCaseListResponseDto> {
    this.logger.log(`Listing test cases for project ${projectId}`);
    return this.testCasesService.listTestCases(projectId, filters);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Obtener estadísticas de test cases' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Estadísticas de test cases',
    type: TestCaseStatisticsDto,
  })
  async getStatistics(
    @Param('projectId') projectId: string,
  ): Promise<TestCaseStatisticsDto> {
    this.logger.log(`Getting test case statistics for project ${projectId}`);
    return this.testCasesService.getStatistics(projectId);
  }

  @Get(':testCaseId')
  @ApiOperation({ summary: 'Obtener un caso de prueba específico' })
  @ApiParam({ name: 'testCaseId', description: 'ID del test case' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Test case encontrado',
    type: TestCaseResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Test case no encontrado',
  })
  async getTestCase(
    @Param('projectId') projectId: string,
    @Param('testCaseId') testCaseId: string,
  ): Promise<TestCaseResponseDto> {
    this.logger.log(`Getting test case ${testCaseId}`);
    return this.testCasesService.findByTestCaseId(testCaseId);
  }

  @Put(':testCaseId')
  @ApiOperation({ summary: 'Actualizar un caso de prueba' })
  @ApiParam({ name: 'testCaseId', description: 'ID del test case' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Test case actualizado exitosamente',
    type: TestCaseResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Test case no encontrado',
  })
  async updateTestCase(
    @Param('projectId') projectId: string,
    @Param('testCaseId') testCaseId: string,
    @Body() dto: UpdateTestCaseDto,
  ): Promise<TestCaseResponseDto> {
    this.logger.log(`Updating test case ${testCaseId}`);
    return this.testCasesService.updateTestCase(testCaseId, dto);
  }

  @Delete(':testCaseId')
  @ApiOperation({ summary: 'Eliminar un caso de prueba' })
  @ApiParam({ name: 'testCaseId', description: 'ID del test case' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Test case eliminado exitosamente',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Test case no encontrado',
  })
  async deleteTestCase(
    @Param('projectId') projectId: string,
    @Param('testCaseId') testCaseId: string,
  ): Promise<{ message: string }> {
    this.logger.log(`Deleting test case ${testCaseId}`);
    await this.testCasesService.deleteTestCase(testCaseId);
    return { message: 'Test case deleted successfully' };
  }

  @Get(':testCaseId/export')
  @ApiOperation({ summary: 'Exportar caso de prueba como Gherkin' })
  @ApiParam({ name: 'testCaseId', description: 'ID del test case' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Test case exportado exitosamente',
    type: TestCaseExportDto,
  })
  async exportTestCase(
    @Param('projectId') projectId: string,
    @Param('testCaseId') testCaseId: string,
  ): Promise<TestCaseExportDto> {
    this.logger.log(`Exporting test case ${testCaseId}`);
    return this.testCasesService.exportTestCase(projectId, testCaseId);
  }

  @Post(':testCaseId/duplicate')
  @ApiOperation({ summary: 'Duplicar un caso de prueba' })
  @ApiParam({ name: 'testCaseId', description: 'ID del test case' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Test case duplicado exitosamente',
    type: TestCaseResponseDto,
  })
  async duplicateTestCase(
    @Param('projectId') projectId: string,
    @Param('testCaseId') testCaseId: string,
    @Body() dto: DuplicateTestCaseDto,
  ): Promise<TestCaseResponseDto> {
    this.logger.log(`Duplicating test case ${testCaseId}`);
    return this.testCasesService.duplicateTestCase(projectId, testCaseId, dto);
  }

  // Endpoints para Step Templates

  @Post('steps')
  @ApiOperation({ summary: 'Crear un nuevo step template' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Step template creado exitosamente',
    type: TestStepResponseDto,
  })
  async createStepTemplate(
    @Param('projectId') projectId: string,
    @Body() dto: CreateStepDto,
  ): Promise<TestStepResponseDto> {
    this.logger.log(`Creating step template for project ${projectId}`);
    return this.stepTemplatesService.createStepTemplate(projectId, dto);
  }

  @Get('steps')
  @ApiOperation({ summary: 'Listar step templates' })
  @ApiQuery({ name: 'type', required: false, description: 'Filtrar por tipo de step' })
  @ApiQuery({ name: 'stepType', required: false, description: 'Filtrar por tipo de template' })
  @ApiQuery({ name: 'category', required: false, description: 'Filtrar por categoría' })
  @ApiQuery({ name: 'status', required: false, description: 'Filtrar por estado' })
  @ApiQuery({ name: 'search', required: false, description: 'Buscar por nombre o definición' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de step templates',
    type: [TestStepResponseDto],
  })
  async listStepTemplates(
    @Param('projectId') projectId: string,
    @Query() filters: any,
  ): Promise<TestStepResponseDto[]> {
    this.logger.log(`Listing step templates for project ${projectId}`);
    return this.stepTemplatesService.listStepTemplates(projectId, filters);
  }

  @Get('steps/statistics')
  @ApiOperation({ summary: 'Obtener estadísticas de step templates' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Estadísticas de step templates',
    type: StepTemplateStatisticsDto,
  })
  async getStepTemplateStatistics(
    @Param('projectId') projectId: string,
  ): Promise<StepTemplateStatisticsDto> {
    this.logger.log(`Getting step template statistics for project ${projectId}`);
    return this.stepTemplatesService.getStatistics(projectId);
  }

  @Get('steps/:stepId')
  @ApiOperation({ summary: 'Obtener un step template específico' })
  @ApiParam({ name: 'stepId', description: 'ID del step template' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Step template encontrado',
    type: TestStepResponseDto,
  })
  async getStepTemplate(
    @Param('projectId') projectId: string,
    @Param('stepId') stepId: string,
  ): Promise<TestStepResponseDto> {
    this.logger.log(`Getting step template ${stepId}`);
    return this.stepTemplatesService.findByStepId(stepId);
  }

  @Put('steps/:stepId')
  @ApiOperation({ summary: 'Actualizar un step template' })
  @ApiParam({ name: 'stepId', description: 'ID del step template' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Step template actualizado exitosamente',
    type: TestStepResponseDto,
  })
  async updateStepTemplate(
    @Param('projectId') projectId: string,
    @Param('stepId') stepId: string,
    @Body() dto: CreateStepDto,
  ): Promise<TestStepResponseDto> {
    this.logger.log(`Updating step template ${stepId}`);
    return this.stepTemplatesService.updateStepTemplate(projectId, stepId, dto);
  }

  @Delete('steps/:stepId')
  @ApiOperation({ summary: 'Eliminar un step template' })
  @ApiParam({ name: 'stepId', description: 'ID del step template' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Step template eliminado exitosamente',
  })
  async deleteStepTemplate(
    @Param('projectId') projectId: string,
    @Param('stepId') stepId: string,
  ): Promise<{ message: string }> {
    this.logger.log(`Deleting step template ${stepId}`);
    await this.stepTemplatesService.deleteStepTemplate(stepId);
    return { message: 'Step template deleted successfully' };
  }

  @Get('steps/:stepId/validate')
  @ApiOperation({ summary: 'Validar un step template' })
  @ApiParam({ name: 'stepId', description: 'ID del step template' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Resultado de la validación',
  })
  async validateStepTemplate(
    @Param('projectId') projectId: string,
    @Param('stepId') stepId: string,
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    this.logger.log(`Validating step template ${stepId}`);
    return this.stepTemplatesService.validateStep(stepId);
  }

  @Get('steps/category/:category')
  @ApiOperation({ summary: 'Obtener step templates por categoría' })
  @ApiParam({ name: 'category', description: 'Categoría de los steps' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de step templates por categoría',
    type: [TestStepResponseDto],
  })
  async getStepTemplatesByCategory(
    @Param('projectId') projectId: string,
    @Param('category') category: string,
  ): Promise<TestStepResponseDto[]> {
    this.logger.log(`Getting step templates by category ${category}`);
    return this.stepTemplatesService.getStepTemplatesByCategory(projectId, category);
  }

  @Get('steps/type/:type')
  @ApiOperation({ summary: 'Obtener step templates por tipo' })
  @ApiParam({ name: 'type', description: 'Tipo de step (Given, When, Then, etc.)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de step templates por tipo',
    type: [TestStepResponseDto],
  })
  async getStepTemplatesByType(
    @Param('projectId') projectId: string,
    @Param('type') type: string,
  ): Promise<TestStepResponseDto[]> {
    this.logger.log(`Getting step templates by type ${type}`);
    return this.stepTemplatesService.getStepTemplatesByType(projectId, type);
  }
} 