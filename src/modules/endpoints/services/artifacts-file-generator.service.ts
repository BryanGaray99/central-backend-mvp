import { Injectable, Logger } from '@nestjs/common';
import { FileSystemService } from '../../projects/services/file-system.service';
import { TemplateService } from '../../projects/services/template.service';
import * as path from 'path';

@Injectable()
export class ArtifactsFileGeneratorService {
  private readonly logger = new Logger(ArtifactsFileGeneratorService.name);
  private readonly templatesPath = path.join(__dirname, '..', 'templates');

  constructor(
    private readonly fileSystemService: FileSystemService,
    private readonly templateService: TemplateService,
  ) {}

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