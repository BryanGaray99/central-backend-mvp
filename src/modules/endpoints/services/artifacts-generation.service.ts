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

      // === INTEGRACIÓN: Actualizar hooks.ts ===
      await this.hooksUpdaterService.updateHooksFile(project.path, dto.entityName, dto.section);
      this.logger.log('hooks.ts actualizado para la entidad ' + dto.entityName);
      // === FIN INTEGRACIÓN ===
    
    this.logger.log('Artifacts generation completed.');
      return result;
    } catch (error) {
      this.logger.error('Error generating artifacts:', error);
      throw error;
    }
  }

  async generateArtifacts(
    dto: RegisterEndpointDto,
    analysisResult: any,
    project: Project,
  ) {
    try {
      console.log('🔍 === DATOS OBTENIDOS DEL ANÁLISIS ===');
      console.log('📋 DTO Original:', {
      entityName: dto.entityName,
        section: dto.section,
      path: dto.path,
        methods: dto.methods?.map((m) => m.method) || [],
      });
      console.log('🔬 Resultado del Análisis:', {
        successCount: Object.values(
          analysisResult.analysisResults || {},
        ).filter((r: any) => r.success).length,
        methods: Object.keys(analysisResult.analysisResults || {}),
        hasSchema:
          !!analysisResult.analysisResults?.['POST']?.inferredResponseSchema,
      });
      console.log('📁 Proyecto:', {
        id: project.id,
        name: project.name,
        baseUrl: project.baseUrl,
      });

      // Build template variables using specialized service
      const templateVariables = this.templateVariablesService.buildTemplateVariables(
        dto,
        analysisResult,
        project,
      );

      console.log('🔧 === VARIABLES DE TEMPLATE GENERADAS ===');
      console.log('📝 Variables para Types:', {
        entityName: templateVariables.entityName,
        fieldsCount: templateVariables.fields.length,
        createFieldsCount: templateVariables.createFields.length,
        updateFieldsCount: templateVariables.updateFields.length,
      });

      console.log('📝 Variables para Schema:', {
        entityName: templateVariables.entityName,
        fieldsCount: templateVariables.fields.length,
        requiredFields: templateVariables.fields
          .filter((f) => f.required)
          .map((f) => f.name),
      });

      console.log('📝 Variables para Fixture:', {
        entityName: templateVariables.entityName,
        fieldsCount: templateVariables.fields.length,
        fakerFields: templateVariables.fields
          .filter((f) => f.isFaker)
          .map((f) => f.name),
      });

      // Generate artifacts (types, schemas, fixtures, clients) - excluding feature and steps
      const result = await this.artifactsFileGeneratorService.generateArtifactsOnly(
        project.path,
        dto.section,
        dto.entityName,
        templateVariables,
      );

      console.log('✅ === GENERACIÓN COMPLETADA ===');
      console.log('🎯 Archivos generados exitosamente para:', dto.entityName);

      return result;
    } catch (error) {
      console.error('❌ Error generating artifacts:', error);
      throw error;
    }
  }
}
