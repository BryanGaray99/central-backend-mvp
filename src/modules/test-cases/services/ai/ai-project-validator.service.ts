import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import { Project } from '../../../projects/project.entity';

@Injectable()
export class AIProjectValidatorService {
  private readonly logger = new Logger(AIProjectValidatorService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  /**
   * Obtiene el proyecto desde la base de datos
   */
  async getProjectFromDatabase(projectId: string): Promise<Project> {
    const project = await this.findProjectById(projectId);
    if (!project) {
      throw new HttpException(
        {
          success: false,
          error: {
            statusCode: HttpStatus.NOT_FOUND,
            message: `Proyecto con ID ${projectId} no encontrado`,
          },
        },
        HttpStatus.NOT_FOUND,
      );
    }
    return project;
  }

  /**
   * Construye la ruta del proyecto usando la configuración
   */
  buildProjectPath(projectName: string): string {
    const workspacesPath = process.env.PLAYWRIGHT_WORKSPACES_PATH || '../playwright-workspaces';
    return path.join(workspacesPath, projectName);
  }

  /**
   * Valida que el proyecto existe en el sistema de archivos
   */
  async validateProjectExists(projectPath: string): Promise<void> {
    try {
      const fs = require('fs').promises;
      await fs.access(projectPath);
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: {
            statusCode: HttpStatus.NOT_FOUND,
            message: `El proyecto no existe en la ruta: ${projectPath}`,
            details: 'Verifique que el proyecto haya sido generado correctamente',
          },
        },
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * Busca el proyecto por ID usando el repositorio
   */
  private async findProjectById(projectId: string): Promise<Project | null> {
    return await this.projectRepository.findOne({ where: { id: projectId } });
  }
} 