import { Controller, Post, Param, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SyncService } from '../services/sync.service';
import { SyncResponseDto } from '../dto/sync-response.dto';

@ApiTags('Sync')
@Controller('sync')
export class SyncController {
  private readonly logger = new Logger(SyncController.name);

  constructor(private readonly syncService: SyncService) {}

  @Post('projects/:projectId')
  @ApiOperation({
    summary: 'Sincronizar proyecto completo',
    description: 'Sincroniza todos los archivos del proyecto con la base de datos: endpoints, test cases y steps'
  })
  @ApiResponse({
    status: 200,
    description: 'Proyecto sincronizado exitosamente',
    type: SyncResponseDto
  })
  @ApiResponse({
    status: 404,
    description: 'Proyecto no encontrado'
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor'
  })
  async syncProject(@Param('projectId') projectId: string) {
    this.logger.log(`Iniciando sincronización del proyecto: ${projectId}`);
    
    try {
      const result = await this.syncService.syncProject(projectId);
      this.logger.log(`Sincronización completada para proyecto: ${projectId}`);
      return result;
    } catch (error) {
      this.logger.error(`Error en sincronización del proyecto ${projectId}:`, error);
      throw error;
    }
  }

  @Post('projects/:projectId/endpoints')
  @ApiOperation({
    summary: 'Sincronizar solo endpoints',
    description: 'Sincroniza únicamente los endpoints del proyecto'
  })
  async syncEndpoints(@Param('projectId') projectId: string) {
    this.logger.log(`Sincronizando endpoints del proyecto: ${projectId}`);
    
    try {
      const result = await this.syncService.syncEndpoints(projectId);
      this.logger.log(`Endpoints sincronizados para proyecto: ${projectId}`);
      return result;
    } catch (error) {
      this.logger.error(`Error sincronizando endpoints del proyecto ${projectId}:`, error);
      throw error;
    }
  }

  @Post('projects/:projectId/test-cases')
  @ApiOperation({
    summary: 'Sincronizar solo test cases',
    description: 'Sincroniza únicamente los test cases del proyecto'
  })
  async syncTestCases(@Param('projectId') projectId: string) {
    this.logger.log(`Sincronizando test cases del proyecto: ${projectId}`);
    
    try {
      const result = await this.syncService.syncTestCases(projectId);
      this.logger.log(`Test cases sincronizados para proyecto: ${projectId}`);
      return result;
    } catch (error) {
      this.logger.error(`Error sincronizando test cases del proyecto ${projectId}:`, error);
      throw error;
    }
  }
}
