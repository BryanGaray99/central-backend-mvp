import {
  Controller,
  Get,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TestExecutionService } from '../services/test-execution.service';

@ApiTags('test-execution')
@Controller('test-execution')
export class GlobalTestExecutionController {
  private readonly logger = new Logger(GlobalTestExecutionController.name);

  constructor(private readonly testExecutionService: TestExecutionService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Obtener resumen global de todas las ejecuciones',
    description: 'Obtiene un resumen estadístico de todas las ejecuciones de todos los proyectos',
  })
  @ApiResponse({
    status: 200,
    description: 'Resumen global obtenido exitosamente',
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