import { Injectable, Logger } from '@nestjs/common';
import { FileSystemService } from '../../projects/services/file-system.service';
import { TemplateService } from '../../projects/services/template.service';
import { TestCaseRegistrationService } from './test-case-registration.service';
import { TestStepRegistrationService } from './test-step-registration.service';
import { Project } from '../../projects/project.entity';
import { RegisterEndpointDto } from '../../endpoints/dto/register-endpoint.dto';
import * as path from 'path';

/**
 * Test Case Generation Service
 *
 * This service handles the generation of test cases and test steps from endpoint analysis.
 * It processes endpoint data, builds template variables, generates feature and step files,
 * and registers the generated test cases and steps in the database.
 *
 * @class TestCaseGenerationService
 * @since 1.0.0
 */
@Injectable()
export class TestCaseGenerationService {
  private readonly logger = new Logger(TestCaseGenerationService.name);
  private readonly templatesPath = path.join(__dirname, '..', 'templates');

  constructor(
    private readonly fileSystemService: FileSystemService,
    private readonly templateService: TemplateService,
    private readonly testCaseRegistrationService: TestCaseRegistrationService,
    private readonly testStepRegistrationService: TestStepRegistrationService,
  ) {}

  /**
   * Generates test cases and steps from endpoint analysis.
   *
   * This method processes endpoint data, builds template variables, generates
   * feature and step files, and registers the generated test cases and steps
   * in the database.
   *
   * @param project - The project entity containing project information
   * @param dto - The endpoint registration data
   * @param analysisResult - The result of endpoint analysis
   * @returns Promise resolving to generation result with success status and data
   * @throws Error when generation process fails
   *
   * @example
   * ```typescript
   * const result = await testCaseGenerationService.generateTestCasesFromEndpoint(
   *   project, endpointDto, analysisResult
   * );
   * ```
   */
  async generateTestCasesFromEndpoint(
    project: Project,
    dto: RegisterEndpointDto,
    analysisResult: any,
  ) {
    this.logger.log(
      `Generating test cases from endpoint for ${dto.entityName} with ${dto.methods.length} methods`,
    );

    try {
      const templateVariables = this.buildTemplateVariables(dto, analysisResult, project);

      await this.generateFeatureAndStepsFiles(project.path, dto.section, dto.entityName, templateVariables);

      await this.testCaseRegistrationService.processFeatureFileAndRegisterTestCases(
        project.id,
        dto.section,
        dto.entityName,
        dto
      );

      await this.testStepRegistrationService.processStepsFileAndRegisterSteps(
        project.id,
        dto.section,
        dto.entityName
      );

      this.logger.log('Test cases and steps generation completed successfully.');
      return {
        success: true,
        message: `Test cases generated successfully for ${dto.entityName}`,
      };
    } catch (error) {
      this.logger.error('Error generating test cases:', error);
      throw error;
    }
  }

  /**
   * Builds template variables for code generation.
   *
   * This private method processes endpoint data and analysis results to create
   * a comprehensive set of variables that can be used in template rendering.
   *
   * @private
   * @param dto - The endpoint registration data
   * @param analysisResult - The result of endpoint analysis
   * @param project - The project entity
   * @returns Object containing all template variables for code generation
   */
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

  /**
   * Gets the expected HTTP status code for a given HTTP method.
   *
   * This private method maps HTTP methods to their expected status codes
   * for test case generation.
   *
   * @private
   * @param method - The HTTP method (GET, POST, PUT, PATCH, DELETE)
   * @returns The expected HTTP status code for the method
   */
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

  /**
   * Extracts field definitions from endpoint analysis results.
   *
   * This private method processes analysis results to extract field information
   * from the POST method response schema for template generation.
   *
   * @private
   * @param analysisResult - The endpoint analysis result
   * @returns Array of field objects with name, type, required status, and examples
   */
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

  /**
   * Extracts field definitions for create operations from analysis results.
   *
   * This private method processes analysis results to extract field information
   * from the POST method request body definition for create operation templates.
   *
   * @private
   * @param analysisResult - The endpoint analysis result
   * @param entityName - The name of the entity being created
   * @returns Array of field objects for create operations
   */
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

  /**
   * Extracts field definitions for update operations from analysis results.
   *
   * This private method processes analysis results to extract field information
   * from PUT or PATCH method request body definitions for update operation templates.
   *
   * @private
   * @param analysisResult - The endpoint analysis result
   * @param entityName - The name of the entity being updated
   * @returns Array of field objects for update operations
   */
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

  /**
   * Maps JSON schema types to TypeScript types.
   *
   * This private method converts JSON schema type definitions to their
   * corresponding TypeScript type representations for template generation.
   *
   * @private
   * @param jsonType - The JSON schema type (string, number, integer, boolean, object, array)
   * @returns The corresponding TypeScript type string
   */
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

  /**
   * Pluralizes a word using simple English pluralization rules.
   *
   * This private method applies basic pluralization rules to convert
   * singular words to their plural forms for template generation.
   *
   * @private
   * @param word - The word to pluralize
   * @returns The pluralized form of the word
   */
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

  /**
   * Generates both feature and steps files for an entity.
   *
   * This private method creates the necessary directories and generates
   * both the Gherkin feature file and the TypeScript steps file for
   * the specified entity and section.
   *
   * @private
   * @param projectPath - The path to the project directory
   * @param section - The section/category name
   * @param entityName - The name of the entity
   * @param variables - The template variables for code generation
   * @returns Promise that resolves when both files are generated
   */
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

  /**
   * Generates a Gherkin feature file from a template.
   *
   * This private method renders a feature template with the provided variables
   * and writes the result to a .feature file in the specified directory.
   *
   * @private
   * @param dir - The directory where to create the feature file
   * @param fileName - The base name for the feature file (without extension)
   * @param variables - The template variables for rendering
   * @returns Promise that resolves when the feature file is generated
   */
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

  /**
   * Generates a TypeScript steps file from a template.
   *
   * This private method renders a steps template with the provided variables
   * and writes the result to a .steps.ts file in the specified directory.
   *
   * @private
   * @param dir - The directory where to create the steps file
   * @param fileName - The base name for the steps file (without extension)
   * @param variables - The template variables for rendering
   * @returns Promise that resolves when the steps file is generated
   */
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
} 