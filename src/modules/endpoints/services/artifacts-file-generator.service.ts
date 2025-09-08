import { Injectable, Logger } from '@nestjs/common';
import { FileSystemService } from '../../projects/services/file-system.service';
import { TemplateService } from '../../projects/services/template.service';
import * as path from 'path';

/**
 * Service responsible for generating testing artifacts files for API endpoints.
 * 
 * This service handles the creation of various testing artifacts including schemas,
 * fixtures, types, and API client files. It uses Handlebars templates to generate
 * TypeScript files that support API testing workflows in Playwright projects.
 * 
 * @class ArtifactsFileGeneratorService
 * @since 1.0.0
 */
@Injectable()
export class ArtifactsFileGeneratorService {
  private readonly logger = new Logger(ArtifactsFileGeneratorService.name);
  private readonly templatesPath = path.join(__dirname, '..', 'templates');

  constructor(
    private readonly fileSystemService: FileSystemService,
    private readonly templateService: TemplateService,
  ) {}

  /**
   * Generates a schema file for API endpoint validation.
   * 
   * This method creates a TypeScript schema file using the schema template
   * and provided variables. The schema file is used for validating API
   * request and response data structures.
   * 
   * @param dir - The directory where the schema file will be created
   * @param fileName - The base name for the schema file (without extension)
   * @param variables - Template variables for schema generation
   * @returns Promise that resolves when the schema file has been generated
   * 
   * @example
   * ```typescript
   * await generator.generateSchemaFile('/project/src/schemas', 'product', schemaVars);
   * // Creates: /project/src/schemas/product.schema.ts
   * ```
   */
  async generateSchemaFile(dir: string, fileName: string, variables: any) {
    const filePath = path.join(dir, `${fileName}.schema.ts`);
    const templatePath = path.join(this.templatesPath, 'schema.template');

    await this.templateService.writeRenderedTemplate(
      templatePath,
      filePath,
      variables,
    );
    this.logger.log(`Schema file generated at: ${filePath}`);
  }

  /**
   * Generates a fixture file for API endpoint testing data.
   * 
   * This method creates a TypeScript fixture file using the fixture template
   * and provided variables. Fixture files contain test data and helper functions
   * for API testing scenarios.
   * 
   * @param dir - The directory where the fixture file will be created
   * @param fileName - The base name for the fixture file (without extension)
   * @param variables - Template variables for fixture generation
   * @returns Promise that resolves when the fixture file has been generated
   * 
   * @example
   * ```typescript
   * await generator.generateFixtureFile('/project/src/fixtures', 'product', fixtureVars);
   * // Creates: /project/src/fixtures/product.fixture.ts
   * ```
   */
  async generateFixtureFile(dir: string, fileName: string, variables: any) {
    const filePath = path.join(dir, `${fileName}.fixture.ts`);
    const templatePath = path.join(this.templatesPath, 'fixture.template');

    await this.templateService.writeRenderedTemplate(
      templatePath,
      filePath,
      variables,
    );
    this.logger.log(`Fixture file generated at: ${filePath}`);
  }

  /**
   * Generates a types file for API endpoint TypeScript definitions.
   * 
   * This method creates a TypeScript types file using the types template
   * and provided variables. Types files contain TypeScript interfaces and
   * type definitions for API request and response structures.
   * 
   * @param dir - The directory where the types file will be created
   * @param fileName - The base name for the types file (without extension)
   * @param variables - Template variables for types generation
   * @returns Promise that resolves when the types file has been generated
   * 
   * @example
   * ```typescript
   * await generator.generateTypesFile('/project/src/types', 'product', typesVars);
   * // Creates: /project/src/types/product.ts
   * ```
   */
  async generateTypesFile(dir: string, fileName: string, variables: any) {
    const filePath = path.join(dir, `${fileName}.ts`);
    const templatePath = path.join(this.templatesPath, 'types.template');

    await this.templateService.writeRenderedTemplate(
      templatePath,
      filePath,
      variables,
    );
    this.logger.log(`Types file generated at: ${filePath}`);
  }

  /**
   * Generates an API client file for endpoint interaction.
   * 
   * This method creates a TypeScript API client file using the entity-client template
   * and provided variables. API client files contain functions for making HTTP requests
   * to specific endpoints with proper typing and error handling.
   * 
   * @param dir - The directory where the API client file will be created
   * @param fileName - The base name for the API client file (without extension)
   * @param variables - Template variables for API client generation
   * @returns Promise that resolves when the API client file has been generated
   * 
   * @example
   * ```typescript
   * await generator.generateApiClientFile('/project/src/api', 'product', clientVars);
   * // Creates: /project/src/api/product.client.ts
   * ```
   */
  async generateApiClientFile(dir: string, fileName: string, variables: any) {
    const filePath = path.join(dir, `${fileName}.client.ts`);
    const templatePath = path.join(
      this.templatesPath,
      'entity-client.template',
    );

    await this.templateService.writeRenderedTemplate(
      templatePath,
      filePath,
      variables,
    );
    this.logger.log(`API Client file generated at: ${filePath}`);
  }

  /**
   * Generates all testing artifacts for an entity in a project.
   * 
   * This method creates the complete set of testing artifacts for an entity,
   * including types, schemas, fixtures, and API client files. It creates the
   * necessary directory structure and generates all files using the provided
   * template variables.
   * 
   * @param projectPath - The root path of the Playwright project
   * @param section - The section/category for organizing the artifacts
   * @param entityName - The name of the entity to generate artifacts for
   * @param variables - Template variables for artifact generation
   * @returns Promise resolving to a result object with success status and generated file paths
   * 
   * @example
   * ```typescript
   * const result = await generator.generateArtifactsOnly('/project', 'ecommerce', 'Product', vars);
   * console.log(result.generatedFiles); // Array of generated file paths
   * ```
   */
  async generateArtifactsOnly(projectPath: string, section: string, entityName: string, variables: any) {
    const entityLower = entityName.toLowerCase();
    
    // Create necessary directories
    const fixturesDir = path.join(projectPath, 'src', 'fixtures', section);
    await this.fileSystemService.createDirectory(fixturesDir);
    
    const schemasDir = path.join(projectPath, 'src', 'schemas', section);
    await this.fileSystemService.createDirectory(schemasDir);
    
    const typesDir = path.join(projectPath, 'src', 'types', section);
    await this.fileSystemService.createDirectory(typesDir);
    
    const apiDir = path.join(projectPath, 'src', 'api', section);
    await this.fileSystemService.createDirectory(apiDir);

    // Generate artifacts only (types, schemas, fixtures, clients) - excluding feature and steps
    await this.generateSchemaFile(schemasDir, entityLower, variables);
    await this.generateFixtureFile(fixturesDir, entityLower, variables);
    await this.generateTypesFile(typesDir, entityLower, variables);
    await this.generateApiClientFile(apiDir, entityLower, variables);

    return {
      success: true,
      message: `Artifacts generated successfully for ${entityName}`,
      generatedFiles: [
        `src/types/${section}/${entityLower}.ts`,
        `src/schemas/${section}/${entityLower}.schema.ts`,
        `src/fixtures/${section}/${entityLower}.fixture.ts`,
        `src/api/${section}/${entityLower}.client.ts`,
      ],
    };
  }
} 