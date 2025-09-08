import { Injectable, Logger } from '@nestjs/common';
import { FileSystemService } from '../../projects/services/file-system.service';
import { TemplateService } from '../../projects/services/template.service';
import { TemplateVariablesService } from './template-variables.service';
import { ArtifactsFileGeneratorService } from './artifacts-file-generator.service';
import { Project } from '../../projects/project.entity';
import { RegisterEndpointDto } from '../dto/register-endpoint.dto';
import { HooksUpdaterService } from './hooks-updater.service';

/**
 * Service responsible for orchestrating the generation of testing artifacts.
 * 
 * This service coordinates the generation of all testing artifacts for API endpoints,
 * including types, schemas, fixtures, API clients, and hooks. It uses specialized
 * services to build template variables, generate files, and update project hooks.
 * 
 * @class ArtifactsGenerationService
 * @since 1.0.0
 */
@Injectable()
export class ArtifactsGenerationService {
  private readonly logger = new Logger(ArtifactsGenerationService.name);

  constructor(
    private readonly fileSystemService: FileSystemService,
    private readonly templateService: TemplateService,
    private readonly templateVariablesService: TemplateVariablesService,
    private readonly artifactsFileGeneratorService: ArtifactsFileGeneratorService,
    private readonly hooksUpdaterService: HooksUpdaterService,
  ) {}

  /**
   * Generates all testing artifacts for an endpoint based on analysis results.
   * 
   * This method orchestrates the complete artifact generation process by building
   * template variables from analysis results, generating all necessary files
   * (types, schemas, fixtures, API clients), and updating project hooks.
   * 
   * @param project - The project configuration and path information
   * @param dto - The endpoint registration data containing entity and method information
   * @param analysisResult - The analysis results from endpoint exploration
   * @returns Promise resolving to the generation result with file paths and status
   * @throws Error when artifact generation fails
   * 
   * @example
   * ```typescript
   * const result = await artifactsGeneration.generate(project, endpointDto, analysis);
   * console.log(result.generatedFiles); // Array of generated file paths
   * ```
   */
  async generate(
    project: Project,
    dto: RegisterEndpointDto,
    analysisResult: any,
  ) {
    this.logger.log(
      `Starting artifacts generation for ${dto.entityName} with ${dto.methods.length} methods`,
    );

    try {
      // Build template variables using specialized service
      const templateVariables = this.templateVariablesService.buildTemplateVariables(
        dto,
        analysisResult,
        project,
      );

      // Generate artifacts (types, schemas, fixtures, clients) - excluding feature and steps
      const result = await this.artifactsFileGeneratorService.generateArtifactsOnly(
        project.path,
        dto.section,
        dto.entityName,
        templateVariables,
      );

      // Update hooks.ts
      await this.hooksUpdaterService.updateHooksFile(project.path, dto.entityName, dto.section);
      this.logger.log('hooks.ts updated for entity ' + dto.entityName);
    
      this.logger.log('Artifacts generation completed.');
      return result;
    } catch (error) {
      this.logger.error('Error generating artifacts:', error);
      throw error;
    }
  }

  // The generateArtifacts method is only used for debug/development, we leave it commented or remove it if not used.
}
