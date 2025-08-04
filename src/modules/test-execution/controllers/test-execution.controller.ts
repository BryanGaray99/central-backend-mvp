import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  Query,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { TestExecutionService } from '../services/test-execution.service';
import { ExecuteTestsDto } from '../dto/execute-tests.dto';
import { ExecutionFiltersDto } from '../dto/execution-filters.dto';

@ApiTags('test-execution')
@Controller('projects/:projectId/test-execution')
export class TestExecutionController {
  private readonly logger = new Logger(TestExecutionController.name);

  constructor(private readonly testExecutionService: TestExecutionService) {}

  @Post('execute')
  @ApiOperation({
    summary: 'Ejecutar casos de prueba',
    description: 'Ejecuta casos de prueba para una entidad específica con filtros opcionales',
  })
  @ApiParam({ name: 'projectId', description: 'ID del proyecto', type: 'string' })
  @ApiResponse({
    status: 202,
    description: 'Ejecución iniciada exitosamente',
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
    description: 'Datos de entrada inválidos o entidad sin casos de prueba',
  })
  @ApiResponse({ status: 404, description: 'Proyecto no encontrado' })
  async executeTests(
    @Param('projectId') projectId: string,
    @Body() dto: ExecuteTestsDto,
  ) {
    const entityName = dto.entityName || 'todos los test cases';
    this.logger.log(
      `[CONTROLLER] Ejecutando pruebas para entidad: ${entityName} en proyecto: ${projectId}`,
    );

    return await this.testExecutionService.executeTests(projectId, dto);
  }

  @Get('results/:executionId')
  @ApiOperation({
    summary: 'Obtener resultados de una ejecución específica',
    description: 'Obtiene los resultados detallados de una ejecución de pruebas',
  })
  @ApiParam({ name: 'projectId', description: 'ID del proyecto', type: 'string' })
  @ApiParam({ name: 'executionId', description: 'ID de la ejecución', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Resultados obtenidos exitosamente',
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
  @ApiResponse({ status: 404, description: 'Ejecución no encontrada' })
  async getResults(
    @Param('projectId') projectId: string,
    @Param('executionId') executionId: string,
  ) {
    this.logger.log(
      `[CONTROLLER] Obteniendo resultados de ejecución: ${executionId}`,
    );

    return await this.testExecutionService.getResults(executionId);
  }

  @Get('results')
  @ApiOperation({
    summary: 'Listar resultados de ejecuciones',
    description: 'Obtiene una lista de ejecuciones con filtros opcionales',
  })
  @ApiParam({ name: 'projectId', description: 'ID del proyecto', type: 'string' })
  @ApiQuery({ name: 'entityName', required: false, description: 'Filtrar por entidad' })
  @ApiQuery({ name: 'method', required: false, description: 'Filtrar por método HTTP' })
  @ApiQuery({ name: 'testType', required: false, description: 'Filtrar por tipo de prueba' })
  @ApiQuery({ name: 'status', required: false, description: 'Filtrar por estado' })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Fecha desde' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'Fecha hasta' })
  @ApiQuery({ name: 'page', required: false, description: 'Número de página', type: 'number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Límite por página', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Lista de ejecuciones obtenida exitosamente',
  })
  async listResults(
    @Param('projectId') projectId: string,
    @Query() filters: ExecutionFiltersDto,
  ) {
    const results = await this.testExecutionService.listResults(projectId, filters);

    return results;
  }

  @Delete('results/:executionId')
  @ApiOperation({
    summary: 'Eliminar resultados de una ejecución',
    description: 'Elimina los resultados de una ejecución específica',
  })
  @ApiParam({ name: 'projectId', description: 'ID del proyecto', type: 'string' })
  @ApiParam({ name: 'executionId', description: 'ID de la ejecución', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Resultados eliminados exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Ejecución no encontrada' })
  async deleteResults(
    @Param('projectId') projectId: string,
    @Param('executionId') executionId: string,
  ) {
    this.logger.log(
      `[CONTROLLER] Eliminando resultados de ejecución: ${executionId}`,
    );

    await this.testExecutionService.deleteResults(executionId);

    return { message: 'Resultados de ejecución eliminados exitosamente' };
  }

  @Get('history/:entityName')
  @ApiOperation({
    summary: 'Obtener historial de ejecuciones por entidad',
    description: 'Obtiene el historial de ejecuciones para una entidad específica',
  })
  @ApiParam({ name: 'projectId', description: 'ID del proyecto', type: 'string' })
  @ApiParam({ name: 'entityName', description: 'Nombre de la entidad', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Historial obtenido exitosamente',
  })
  async getExecutionHistory(
    @Param('projectId') projectId: string,
    @Param('entityName') entityName: string,
  ) {
    this.logger.log(
      `[CONTROLLER] Obteniendo historial para entidad: ${entityName}`,
    );

    return await this.testExecutionService.getExecutionHistory(
      projectId,
      entityName,
    );
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Obtener resumen de ejecuciones del proyecto',
    description: 'Obtiene un resumen estadístico de todas las ejecuciones del proyecto',
  })
  @ApiParam({ name: 'projectId', description: 'ID del proyecto', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Resumen obtenido exitosamente',
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
    this.logger.log(
      `[CONTROLLER] Obteniendo resumen de ejecuciones para proyecto: ${projectId}`,
    );

    return await this.testExecutionService.getExecutionSummary(projectId);
  }
} 