import { Injectable, Logger } from '@nestjs/common';
import { FileSystemService } from '../../projects/services/file-system.service';
import { TemplateService } from '../../projects/services/template.service';
import { TemplateVariablesService } from './template-variables.service';
import { ArtifactsFileGeneratorService } from './artifacts-file-generator.service';
import { Project } from '../../projects/project.entity';
import { RegisterEndpointDto } from '../dto/register-endpoint.dto';
import { HooksUpdaterService } from './hooks-updater.service';

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

      // Actualizar hooks.ts
      await this.hooksUpdaterService.updateHooksFile(project.path, dto.entityName, dto.section);
      this.logger.log('hooks.ts actualizado para la entidad ' + dto.entityName);
    
      this.logger.log('Artifacts generation completed.');
      return result;
    } catch (error) {
      this.logger.error('Error generating artifacts:', error);
      throw error;
    }
  }

  // El método generateArtifacts solo se usa para debug/desarrollo, lo dejamos comentado o lo eliminamos si no se usa.
}
