import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateProjectDto } from '../dto/create-project.dto';

@Injectable()
export class ValidationService {
  
  /**
   * Valida la configuración de entrada para crear un proyecto
   */
  validateProjectConfiguration(dto: CreateProjectDto): void {
    // Validar nombre del proyecto
    this.validateProjectName(dto.name);
    
    // Validar URL base
    this.validateBaseUrl(dto.baseUrl);
    
    // Validar metadatos si existen
    if (dto.metadata) {
      this.validateMetadata(dto.metadata);
    }
  }

  /**
   * Valida el nombre del proyecto
   */
  private validateProjectName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new BadRequestException('El nombre del proyecto no puede estar vacío');
    }

    if (name.length > 50) {
      throw new BadRequestException('El nombre del proyecto no puede exceder 50 caracteres');
    }

    // Validar caracteres permitidos (solo letras, números, guiones y guiones bajos)
    const nameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!nameRegex.test(name)) {
      throw new BadRequestException('El nombre del proyecto solo puede contener letras, números, guiones (-) y guiones bajos (_)');
    }


    // Validar nombres reservados
    const reservedNames = ['node_modules', 'dist', 'build', 'src', 'test', 'tests', 'playwright-workspaces'];
    if (reservedNames.includes(name.toLowerCase())) {
      throw new BadRequestException(`El nombre '${name}' está reservado y no puede ser usado`);
    }
  }

  /**
   * Valida la URL base
   */
  private validateBaseUrl(baseUrl: string): void {
    if (!baseUrl || baseUrl.trim().length === 0) {
      throw new BadRequestException('La URL base no puede estar vacía');
    }

    try {
      const url = new URL(baseUrl);
      
      // Validar protocolo
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new BadRequestException('La URL base debe usar HTTP o HTTPS');
      }

      // Validar que tenga hostname
      if (!url.hostname) {
        throw new BadRequestException('La URL base debe incluir un hostname válido');
      }

      // Validar longitud
      if (baseUrl.length > 500) {
        throw new BadRequestException('La URL base no puede exceder 500 caracteres');
      }

    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('La URL base no tiene un formato válido');
    }
  }

  /**
   * Valida los metadatos del proyecto
   */
  private validateMetadata(metadata: Record<string, any>): void {
    if (typeof metadata !== 'object' || metadata === null) {
      throw new BadRequestException('Los metadatos deben ser un objeto válido');
    }

    // Validar tamaño máximo de metadatos (1MB)
    const metadataSize = JSON.stringify(metadata).length;
    if (metadataSize > 1024 * 1024) {
      throw new BadRequestException('Los metadatos no pueden exceder 1MB');
    }

    // Validar claves de metadatos
    for (const [key, value] of Object.entries(metadata)) {
      if (typeof key !== 'string' || key.length === 0) {
        throw new BadRequestException('Las claves de metadatos deben ser strings no vacíos');
      }

      if (key.length > 100) {
        throw new BadRequestException('Las claves de metadatos no pueden exceder 100 caracteres');
      }

      // Validar que las claves no contengan caracteres peligrosos
      const keyRegex = /^[a-zA-Z0-9_-]+$/;
      if (!keyRegex.test(key)) {
        throw new BadRequestException('Las claves de metadatos solo pueden contener letras, números, guiones (-) y guiones bajos (_)');
      }

      // Validar valores (no permitir funciones)
      if (typeof value === 'function') {
        throw new BadRequestException('Los metadatos no pueden contener funciones');
      }
    }
  }

  /**
   * Valida la configuración de workspace
   */
  validateWorkspaceConfiguration(workspacePath: string): void {
    if (!workspacePath || workspacePath.trim().length === 0) {
      throw new BadRequestException('La ruta del workspace no puede estar vacía');
    }

    // Validar que la ruta no contenga caracteres peligrosos
    const dangerousChars = /[<>:"|?*\x00-\x1f]/;
    if (dangerousChars.test(workspacePath)) {
      throw new BadRequestException('La ruta del workspace contiene caracteres no permitidos');
    }

    // Validar longitud de ruta
    if (workspacePath.length > 500) {
      throw new BadRequestException('La ruta del workspace no puede exceder 500 caracteres');
    }
  }
} 