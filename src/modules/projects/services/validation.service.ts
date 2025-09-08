import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateProjectDto } from '../dto/create-project.dto';
import * as path from 'path';

/**
 * Service for validating project configuration and workspace settings.
 * 
 * This service provides comprehensive validation for project creation requests,
 * including name validation, URL validation, and workspace path validation.
 * It ensures that all project configurations meet the required standards
 * and security requirements.
 * 
 * @class ValidationService
 * @since 1.0.0
 */
@Injectable()
export class ValidationService {
  /**
   * Validates input configuration for creating a project.
   * 
   * This method performs comprehensive validation of all project configuration
   * fields to ensure they meet the required standards.
   * 
   * @param dto - The project creation data to validate
   * @throws {BadRequestException} When validation fails
   * 
   * @example
   * ```typescript
   * try {
   *   validationService.validateProjectConfiguration(createDto);
   *   console.log('Validation passed');
   * } catch (error) {
   *   console.error('Validation failed:', error.message);
   * }
   * ```
   */
  validateProjectConfiguration(dto: CreateProjectDto): void {
    // Validate project name
    this.validateProjectName(dto.name);

    // Validate base URL
    this.validateBaseUrl(dto.baseUrl);
  }

  /**
   * Validates project name.
   * 
   * Ensures the project name meets all requirements including length,
   * character restrictions, and reserved name checks.
   * 
   * @param name - The project name to validate
   * @throws {BadRequestException} When name validation fails
   * @private
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
   * Validates base URL.
   * 
   * Ensures the base URL is properly formatted, uses a valid protocol,
   * and meets length requirements.
   * 
   * @param baseUrl - The base URL to validate
   * @throws {BadRequestException} When URL validation fails
   * @private
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
   * Validates workspace configuration.
   * 
   * Ensures the workspace path and name meet security and length requirements.
   * Validates only the workspace name for dangerous characters, not the full path.
   * 
   * @param workspacePath - The workspace path to validate
   * @throws {BadRequestException} When workspace validation fails
   * 
   * @example
   * ```typescript
   * try {
   *   validationService.validateWorkspaceConfiguration('/path/to/workspace');
   *   console.log('Workspace validation passed');
   * } catch (error) {
   *   console.error('Workspace validation failed:', error.message);
   * }
   * ```
   */
  validateWorkspaceConfiguration(workspacePath: string): void {
    if (!workspacePath || workspacePath.trim().length === 0) {
      throw new BadRequestException('Workspace path cannot be empty');
    }

    // Only validate the workspace name, not the full path
    const workspaceName = path.basename(workspacePath);

    // Validate dangerous characters only in the name
    const dangerousChars = /[<>:"|?*\x00-\x1f]/;
    if (dangerousChars.test(workspaceName)) {
      throw new BadRequestException(
        'Workspace name contains disallowed characters',
      );
    }

    // Validate name length
    if (workspaceName.length > 50) {
      throw new BadRequestException(
        'Workspace name cannot exceed 50 characters',
      );
    }

    // Validate full path length (optional, but more permissive)
    if (workspacePath.length > 500) {
      throw new BadRequestException(
        'Workspace path cannot exceed 500 characters',
      );
    }
  }
}
