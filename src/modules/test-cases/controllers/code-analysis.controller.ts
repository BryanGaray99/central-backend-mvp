import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TSMorphService } from '../services/code-manipulation/ts-morph.service';
import { Project } from '../../projects/project.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@ApiTags('Code Analysis')
@Controller('projects/:projectId/code-analysis')
export class CodeAnalysisController {
  private readonly logger = new Logger(CodeAnalysisController.name);

  constructor(
    private readonly tsMorphService: TSMorphService,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Analizar proyecto con TS-Morph',
    description: 'Realiza un análisis completo del proyecto usando TS-Morph.',
  })
  @ApiResponse({
    status: 200,
    description: 'Análisis completado',
  })
  async analyzeProject(@Param('projectId') projectId: string) {
    try {
      const project = await this.projectRepository.findOne({ where: { id: projectId } });
      if (!project) {
        throw new HttpException(
          {
            success: false,
            error: {
              statusCode: HttpStatus.NOT_FOUND,
              message: 'Proyecto no encontrado',
            },
          },
          HttpStatus.NOT_FOUND,
        );
      }

      const projectPath = `../playwright-workspaces/${project.name}`;
      const analysis = await this.tsMorphService.analyzeProject(projectPath);

      return {
        success: true,
        data: {
          analysis,
          projectId,
          projectPath,
          projectName: project.name,
        },
        message: 'Análisis del proyecto completado',
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Error al analizar proyecto',
            details: error.message,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('force-new')
  @ApiOperation({
    summary: 'Forzar nuevo análisis del proyecto',
    description: 'Elimina el análisis existente y realiza un nuevo análisis completo del proyecto.',
  })
  @ApiResponse({
    status: 200,
    description: 'Nuevo análisis completado',
  })
  async forceNewAnalysis(@Param('projectId') projectId: string) {
    try {
      const project = await this.projectRepository.findOne({ where: { id: projectId } });
      if (!project) {
        throw new HttpException(
          {
            success: false,
            error: {
              statusCode: HttpStatus.NOT_FOUND,
              message: 'Proyecto no encontrado',
            },
          },
          HttpStatus.NOT_FOUND,
        );
      }

      const projectPath = `../playwright-workspaces/${project.name}`;
      const analysis = await this.tsMorphService.forceNewAnalysis(projectPath);

      return {
        success: true,
        data: {
          analysis,
          projectId,
          projectPath,
          projectName: project.name,
        },
        message: 'Nuevo análisis del proyecto completado',
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Error al forzar nuevo análisis',
            details: error.message,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('info')
  @ApiOperation({
    summary: 'Obtener información del análisis',
    description: 'Obtiene información sobre el análisis guardado sin realizar nuevo análisis.',
  })
  @ApiResponse({
    status: 200,
    description: 'Información del análisis obtenida',
  })
  async getAnalysisInfo(@Param('projectId') projectId: string) {
    try {
      const project = await this.projectRepository.findOne({ where: { id: projectId } });
      if (!project) {
        throw new HttpException(
          {
            success: false,
            error: {
              statusCode: HttpStatus.NOT_FOUND,
              message: 'Proyecto no encontrado',
            },
          },
          HttpStatus.NOT_FOUND,
        );
      }

      const projectPath = `../playwright-workspaces/${project.name}`;
      const info = await this.tsMorphService.getAnalysisInfo(projectPath);

      return {
        success: true,
        data: {
          info,
          projectId,
          projectPath,
          projectName: project.name,
        },
        message: 'Información del análisis obtenida',
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Error al obtener información del análisis',
            details: error.message,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('clear')
  @ApiOperation({
    summary: 'Eliminar análisis guardado',
    description: 'Elimina el archivo de análisis guardado del proyecto.',
  })
  @ApiResponse({
    status: 200,
    description: 'Análisis eliminado',
  })
  async clearAnalysis(@Param('projectId') projectId: string) {
    try {
      const project = await this.projectRepository.findOne({ where: { id: projectId } });
      if (!project) {
        throw new HttpException(
          {
            success: false,
            error: {
              statusCode: HttpStatus.NOT_FOUND,
              message: 'Proyecto no encontrado',
            },
          },
          HttpStatus.NOT_FOUND,
        );
      }

      const projectPath = `../playwright-workspaces/${project.name}`;
      await this.tsMorphService.clearAnalysis(projectPath);

      return {
        success: true,
        data: {
          projectId,
          projectPath,
          projectName: project.name,
        },
        message: 'Análisis eliminado exitosamente',
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Error al eliminar análisis',
            details: error.message,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
} 