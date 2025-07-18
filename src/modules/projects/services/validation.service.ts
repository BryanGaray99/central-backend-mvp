import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateProjectDto } from '../dto/create-project.dto';
import * as path from 'path';

@Injectable()
export class ValidationService {
  /**
   * Validates input configuration for creating a project
   */
  validateProjectConfiguration(dto: CreateProjectDto): void {
    // Validate project name
    this.validateProjectName(dto.name);

    // Validate base URL
    this.validateBaseUrl(dto.baseUrl);
  }

  /**
   * Validates project name
   */
  private validateProjectName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new BadRequestException('Project name cannot be empty');
    }

    if (name.length > 50) {
      throw new BadRequestException('Project name cannot exceed 50 characters');
    }

    // Validate allowed characters (only letters, numbers, hyphens and underscores)
    const nameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!nameRegex.test(name)) {
      throw new BadRequestException(
        'Project name can only contain letters, numbers, hyphens (-) and underscores (_)',
      );
    }

    // Validate reserved names
    const reservedNames = [
      'node_modules',
      'dist',
      'build',
      'src',
      'test',
      'tests',
      'playwright-workspaces',
    ];
    if (reservedNames.includes(name.toLowerCase())) {
      throw new BadRequestException(
        `Name '${name}' is reserved and cannot be used`,
      );
    }
  }

  /**
   * Validates base URL
   */
  private validateBaseUrl(baseUrl: string): void {
    if (!baseUrl || baseUrl.trim().length === 0) {
      throw new BadRequestException('Base URL cannot be empty');
    }

    try {
      const url = new URL(baseUrl);

      // Validate protocol
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new BadRequestException('Base URL must use HTTP or HTTPS');
      }

      // Validate that it has a hostname
      if (!url.hostname) {
        throw new BadRequestException('Base URL must include a valid hostname');
      }

      // Validate length
      if (baseUrl.length > 500) {
        throw new BadRequestException('Base URL cannot exceed 500 characters');
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Base URL does not have a valid format');
    }
  }



  /**
   * Validates workspace configuration
   */
  validateWorkspaceConfiguration(workspacePath: string): void {
    if (!workspacePath || workspacePath.trim().length === 0) {
      throw new BadRequestException('Workspace path cannot be empty');
    }

    // Solo valida el nombre del workspace, no la ruta completa
    const workspaceName = path.basename(workspacePath);

    // Validar caracteres peligrosos solo en el nombre
    const dangerousChars = /[<>:"|?*\x00-\x1f]/;
    if (dangerousChars.test(workspaceName)) {
      throw new BadRequestException(
        'Workspace name contains disallowed characters',
      );
    }

    // Validar longitud del nombre
    if (workspaceName.length > 50) {
      throw new BadRequestException(
        'Workspace name cannot exceed 50 characters',
      );
    }

    // Validar longitud de la ruta completa (opcional, pero más permisivo)
    if (workspacePath.length > 500) {
      throw new BadRequestException(
        'Workspace path cannot exceed 500 characters',
      );
    }
  }
}
