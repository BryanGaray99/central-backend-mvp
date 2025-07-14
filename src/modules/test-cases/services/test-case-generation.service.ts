import { Injectable, Logger } from '@nestjs/common';
import { FileSystemService } from '../../projects/services/file-system.service';
import { TemplateService } from '../../projects/services/template.service';
import { TestCasesService } from './test-cases.service';
import { StepTemplatesService } from './step-templates.service';
import { FeatureFileManagerService } from './feature-file-manager.service';
import { StepsFileManagerService } from './steps-file-manager.service';
import { TestCaseRegistrationService } from './test-case-registration.service';
import { Project } from '../../projects/project.entity';
import { RegisterEndpointDto } from '../../endpoints/dto/register-endpoint.dto';
import * as path from 'path';

@Injectable()
export class TestCaseGenerationService {
  private readonly logger = new Logger(TestCaseGenerationService.name);
  private readonly templatesPath = path.join(__dirname, '..', 'templates');

  constructor(
    private readonly fileSystemService: FileSystemService,
    private readonly templateService: TemplateService,
    private readonly testCasesService: TestCasesService,
    private readonly stepTemplatesService: StepTemplatesService,
    private readonly featureFileManagerService: FeatureFileManagerService,
    private readonly stepsFileManagerService: StepsFileManagerService,
    private readonly testCaseRegistrationService: TestCaseRegistrationService,
  ) {}

  // ✅ MÉTODO EN USO - Se llama desde endpoints para generar features y steps
  async generateTestCasesFromEndpoint(
    project: Project,
    dto: RegisterEndpointDto,
    analysisResult: any,
  ) {
    this.logger.log(
      `Generating test cases from endpoint for ${dto.entityName} with ${dto.methods.length} methods`,
    );

    try {
      // Build template variables for test case generation
      const templateVariables = this.buildTemplateVariables(dto, analysisResult, project);

      // Generate feature and steps files
      await this.generateFeatureAndStepsFiles(project.path, dto.section, dto.entityName, templateVariables);

      // ✅ HABILITADO: Registrar test cases en la base de datos
      await this.testCaseRegistrationService.processFeatureFileAndRegisterTestCases(
        project.id,
        dto.section,
        dto.entityName,
        dto
      );

      this.logger.log('Test cases generation completed successfully.');
      return {
        success: true,
        message: `Test cases generated successfully for ${dto.entityName}`,
      };
    } catch (error) {
      this.logger.error('Error generating test cases:', error);
      throw error;
    }
  }

  // ✅ MÉTODOS DE SOPORTE EN USO - Para generar archivos feature y steps
  private buildTemplateVariables(dto: RegisterEndpointDto, analysisResult: any, project: Project) {
    // Extract fields from analysis result
    const fields = this.extractFieldsFromAnalysis(analysisResult);
    const createFields = this.extractCreateFields(analysisResult, dto.entityName);
    const updateFields = this.extractUpdateFields(analysisResult, dto.entityName);

    return {
      entityName: dto.entityName,
      entityNameLower: dto.entityName.toLowerCase(),
      entityLowerClient: `${dto.entityName.toLowerCase()}Client`,
      entityNamePlural: this.pluralize(dto.entityName),
      section: dto.section,
      fields,
      createFields,
      updateFields,
      methods: dto.methods.map(method => ({
        ...method,
        expectedStatusCode: this.getExpectedStatusCode(method.method)
      })),
      path: dto.path,
      endpointPath: dto.path,
      baseUrl: project.baseUrl,
      basePath: project.basePath || '/v1/api',
      projectName: project.name,
      // Add helper functions for template
      invalidValue: (type: string) => {
        switch (type) {
          case 'string': return "''";
          case 'number': return '-100';
          case 'boolean': return 'null as any';
          default: return "''";
        }
      }
    };
  }

  private getExpectedStatusCode(method: string): number {
    const statusMap: Record<string, number> = {
      'GET': 200,
      'POST': 201,
      'PUT': 200,
      'PATCH': 200,
      'DELETE': 204,
    };
    return statusMap[method] || 200;
  }

  private extractFieldsFromAnalysis(analysisResult: any) {
    const fields: Array<{
      name: string;
      type: string;
      required: boolean;
      example?: any;
    }> = [];
    const analysisResults = analysisResult.analysisResults || {};

    // Extract fields from POST method (create) response
    if (analysisResults.POST?.inferredResponseSchema?.properties) {
      const properties = analysisResults.POST.inferredResponseSchema.properties;
      for (const [fieldName, fieldData] of Object.entries(properties)) {
        const field = fieldData as any;
        fields.push({
          name: fieldName,
          type: this.mapJsonTypeToTypeScript(field.type || 'string'),
          required: analysisResults.POST.inferredResponseSchema.required?.includes(fieldName) || false,
          example: field.example,
        });
      }
    }

    return fields;
  }

  private extractCreateFields(analysisResult: any, entityName: string) {
    const createFields: Array<{
      name: string;
      type: string;
      required: boolean;
      example?: any;
    }> = [];
    const analysisResults = analysisResult.analysisResults || {};

    if (analysisResults.POST?.requestBodyDefinition) {
      for (const field of analysisResults.POST.requestBodyDefinition) {
        createFields.push({
          name: field.name,
          type: this.mapJsonTypeToTypeScript(field.type),
          required: field.validations?.required || false,
          example: field.example,
        });
      }
    }

    return createFields;
  }

  private extractUpdateFields(analysisResult: any, entityName: string) {
    const updateFields: Array<{
      name: string;
      type: string;
      required: boolean;
      example?: any;
    }> = [];
    const analysisResults = analysisResult.analysisResults || {};

    // Check both PUT and PATCH for update fields
    const updateMethod = analysisResults.PUT || analysisResults.PATCH;
    
    if (updateMethod?.requestBodyDefinition) {
      for (const field of updateMethod.requestBodyDefinition) {
        updateFields.push({
          name: field.name,
          type: this.mapJsonTypeToTypeScript(field.type),
          required: field.validations?.required || false,
          example: field.example,
        });
      }
    }

    return updateFields;
  }

  private mapJsonTypeToTypeScript(jsonType: string): string {
    const typeMap: Record<string, string> = {
      string: 'string',
      number: 'number',
      integer: 'number',
      boolean: 'boolean',
      object: 'object',
      array: 'any[]',
    };
    return typeMap[jsonType] || 'string';
  }

  private pluralize(word: string): string {
    // Simple pluralization rules
    if (word.endsWith('y')) {
      return word.slice(0, -1) + 'ies';
    }
    if (word.endsWith('s') || word.endsWith('sh') || word.endsWith('ch') || word.endsWith('x') || word.endsWith('z')) {
      return word + 'es';
    }
    return word + 's';
  }

  private async generateFeatureAndStepsFiles(
    projectPath: string,
    section: string,
    entityName: string,
    variables: any,
  ) {
    const entityLower = entityName.toLowerCase();
    
    // Create necessary directories
    const featuresDir = path.join(projectPath, 'src', 'features', section);
    await this.fileSystemService.createDirectory(featuresDir);
    
    const stepsDir = path.join(projectPath, 'src', 'steps', section);
    await this.fileSystemService.createDirectory(stepsDir);

    // Generate feature file
    await this.generateFeatureFile(featuresDir, entityLower, variables);
    
    // Generate steps file
    await this.generateStepsFile(stepsDir, entityLower, variables);
  }

  private async generateFeatureFile(dir: string, fileName: string, variables: any) {
    const filePath = path.join(dir, `${fileName}.feature`);
    const templatePath = path.join(this.templatesPath, 'feature.template');

    await this.templateService.writeRenderedTemplate(
      templatePath,
      filePath,
      variables,
    );
    this.logger.log(`Feature file generated at: ${filePath}`);
  }

  private async generateStepsFile(dir: string, fileName: string, variables: any) {
    const filePath = path.join(dir, `${fileName}.steps.ts`);
    const templatePath = path.join(this.templatesPath, 'steps.template');

    await this.templateService.writeRenderedTemplate(
      templatePath,
      filePath,
      variables,
    );
    this.logger.log(`Steps file generated at: ${filePath}`);
  }

  // TODO: FUTURA IMPLEMENTACIÓN CON IA - Crear test cases en base de datos
  private async createTestCasesFromEndpoint(
    projectId: string,
    dto: RegisterEndpointDto,
    templateVariables: any,
  ) {
    // TODO: Implementar con IA para generar test cases inteligentes
    // - Analizar patrones de uso
    // - Generar casos edge case
    // - Crear casos de prueba negativos
    // - Optimizar cobertura de testing
    throw new Error('TODO: Implementar con IA - createTestCasesFromEndpoint');
  }

  // TODO: FUTURA IMPLEMENTACIÓN CON IA - Crear test case para método específico
  private async createTestCaseForMethod(
    projectId: string,
    dto: RegisterEndpointDto,
    method: any,
    templateVariables: any,
  ) {
    // TODO: Implementar con IA para generar test cases específicos por método
    // - Análisis de parámetros del método
    // - Generación de casos de prueba específicos
    // - Validación de respuestas esperadas
    throw new Error('TODO: Implementar con IA - createTestCaseForMethod');
  }

  // TODO: FUTURA IMPLEMENTACIÓN CON IA - Construir escenario para método
  private buildScenarioForMethod(method: any, templateVariables: any) {
    // TODO: Implementar con IA para generar escenarios inteligentes
    // - Análisis de flujo de datos
    // - Generación de steps contextuales
    // - Optimización de cobertura
    throw new Error('TODO: Implementar con IA - buildScenarioForMethod');
  }
} 