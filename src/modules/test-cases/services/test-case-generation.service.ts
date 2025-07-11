import { Injectable, Logger } from '@nestjs/common';
import { FileSystemService } from '../../projects/services/file-system.service';
import { TemplateService } from '../../projects/services/template.service';
import { TestCasesService } from './test-cases.service';
import { StepTemplatesService } from './step-templates.service';
import { FeatureFileManagerService } from './feature-file-manager.service';
import { StepsFileManagerService } from './steps-file-manager.service';
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
  ) {}

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

      // Create test cases in database
      await this.createTestCasesFromEndpoint(project.id, dto, templateVariables);

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

  private buildTemplateVariables(dto: RegisterEndpointDto, analysisResult: any, project: Project) {
    // Extract fields from analysis result
    const fields = this.extractFieldsFromAnalysis(analysisResult);
    const createFields = this.extractCreateFields(analysisResult, dto.entityName);
    const updateFields = this.extractUpdateFields(analysisResult, dto.entityName);

    return {
      entityName: dto.entityName,
      entityNameLower: dto.entityName.toLowerCase(),
      section: dto.section,
      fields,
      createFields,
      updateFields,
      methods: dto.methods,
      path: dto.path,
      baseUrl: project.baseUrl,
      basePath: project.basePath || '/v1/api',
      projectName: project.name,
    };
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

    if (analysisResults.PUT?.requestBodyDefinition) {
      for (const field of analysisResults.PUT.requestBodyDefinition) {
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

  private async createTestCasesFromEndpoint(
    projectId: string,
    dto: RegisterEndpointDto,
    templateVariables: any,
  ) {
    // Create test cases for each method
    for (const method of dto.methods) {
      await this.createTestCaseForMethod(projectId, dto, method, templateVariables);
    }
  }

  private async createTestCaseForMethod(
    projectId: string,
    dto: RegisterEndpointDto,
    method: any,
    templateVariables: any,
  ) {
    const testCaseData = {
      name: `${method.method} ${dto.entityName} with valid data`,
      description: `Test ${method.method} operation for ${dto.entityName}`,
      entityName: dto.entityName,
      section: dto.section,
      method: method.method,
      testType: 'positive' as any,
      tags: ['@smoke', `@${method.method.toLowerCase()}`],
      scenario: this.buildScenarioForMethod(method, templateVariables),
    };

    await this.testCasesService.createTestCase(projectId, testCaseData);
  }

  private buildScenarioForMethod(method: any, templateVariables: any) {
    const entityName = templateVariables.entityName;
    const entityNameLower = templateVariables.entityNameLower;

    const scenario = {
      given: [
        {
          stepId: `ST-${entityName.toUpperCase()}-SETUP-01`,
          parameters: { entityName },
          order: 0,
        },
      ],
      when: [
        {
          stepId: `ST-${entityName.toUpperCase()}-${method.method}-01`,
          parameters: { entityName },
          order: 0,
        },
      ],
      then: [
        {
          stepId: `ST-${entityName.toUpperCase()}-VALIDATE-01`,
          parameters: { entityName },
          order: 0,
        },
      ],
    };

    return scenario;
  }
} 