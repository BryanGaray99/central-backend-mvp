import { Injectable, Logger } from '@nestjs/common';
import { Project, ProjectStatus } from './project.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as path from 'path';
import { FileSystemService } from './services/file-system.service';
import { TemplateService } from './services/template.service';
import { PlaywrightService } from './services/playwright.service';
import { CleanupService } from './services/cleanup.service';
import {
  PROJECT_STRUCTURE,
  TEMPLATE_FILES,
} from './constants/project-structure';

/**
 * Service for generating complete testing projects.
 * 
 * This service orchestrates the entire project generation process, including
 * Playwright initialization, directory structure creation, template processing,
 * and health checks. It coordinates with various specialized services to
 * create fully functional testing projects.
 * 
 * @class GenerationService
 * @since 1.0.0
 */
@Injectable()
export class GenerationService {
  /** Logger instance for this service */
  private readonly logger = new Logger(GenerationService.name);

  /**
   * Creates an instance of GenerationService.
   * 
   * @param projectRepo - TypeORM repository for Project entity
   * @param fileSystemService - Service for file system operations
   * @param templateService - Service for template processing
   * @param playwrightService - Service for Playwright operations
   * @param cleanupService - Service for cleanup operations
   */
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    private readonly fileSystemService: FileSystemService,
    private readonly templateService: TemplateService,
    private readonly playwrightService: PlaywrightService,
    private readonly cleanupService: CleanupService,
  ) {}

  /**
   * Generates a complete testing project.
   * 
   * This method orchestrates the entire project generation process:
   * 1. Initializes Playwright project structure
   * 2. Creates BDD directory structure
   * 3. Generates files from templates
   * 4. Runs health checks
   * 5. Updates project status
   * 
   * @param project - The project to generate
   * @returns Promise that resolves when generation is complete
   * @throws {Error} When generation fails
   * 
   * @example
   * ```typescript
   * const project = await projectRepo.findOne({ where: { id: 'project-id' } });
   * await generationService.generateProject(project);
   * console.log('Project generated successfully');
   * ```
   */
  async generateProject(project: Project): Promise<void> {
    try {
      await this.updateProjectStatus(project.id, ProjectStatus.PENDING);
      
      // Initialize Playwright project (this creates the basic structure)
      await this.playwrightService.initializeProject(project);
      
      // Create additional structure for BDD BEFORE generating files
      await this.fileSystemService.createDirectoryStructure(
        project.path,
        PROJECT_STRUCTURE,
      );
      
      // Generate/modify files from templates
      await this.generateProjectFiles(project);
      
      // Run health check before marking as ready
      const isHealthy = await this.playwrightService.runHealthCheck(project);
      
      if (isHealthy) {
        await this.updateProjectStatus(project.id, ProjectStatus.READY);
      } else {
        throw new Error('Health check failed');
      }
    } catch (error) {
      this.logger.error(
        `Error generating project ${project.name}: ${error.message}`,
      );
      await this.updateProjectStatus(project.id, ProjectStatus.FAILED);
      
      // Execute automatic cleanup in case of failure
      await this.cleanupService.cleanupFailedProject(project, error);
      
      throw error;
    }
  }

  /**
   * Generates all project files from templates.
   * 
   * This method creates all necessary files for a testing project using
   * predefined templates with project-specific variables.
   * 
   * @param project - The project for which to generate files
   * @returns Promise that resolves when all files are generated
   * @private
   */
  private async generateProjectFiles(project: Project): Promise<void> {
    const templateVariables = {
      name: project.name,
      baseUrl: project.baseUrl,
      basePath: '/v1/api', // Default API base path
      author: '',
      description: 'API testing project with Playwright + BDD',
    };

    // Modify existing package.json with our configurations
    await this.templateService.writeRenderedTemplate(
      TEMPLATE_FILES.PACKAGE_JSON,
      path.join(project.path, 'package.json'),
      templateVariables,
    );

    // Generate tsconfig.json
    await this.templateService.writeRenderedTemplate(
      path.join(__dirname, 'templates', 'tsconfig.json.template'),
      path.join(project.path, 'tsconfig.json'),
      templateVariables,
    );

    // Modify existing playwright.config.ts
    await this.templateService.writeRenderedTemplate(
      TEMPLATE_FILES.PLAYWRIGHT_CONFIG,
      path.join(project.path, 'playwright.config.ts'),
      templateVariables,
    );

    // Generate BaseApiClient.ts
    await this.templateService.writeRenderedTemplate(
      path.join(__dirname, 'templates', 'base-api-client.template'),
      path.join(project.path, 'src/api/BaseApiClient.ts'),
      templateVariables,
    );

    // Generate global-setup.ts
    await this.templateService.writeRenderedTemplate(
      path.join(__dirname, 'templates', 'global-setup.ts.template'),
      path.join(project.path, 'src/api/global-setup.ts'),
      templateVariables,
    );

    // Generate global-teardown.ts
    await this.templateService.writeRenderedTemplate(
      path.join(__dirname, 'templates', 'global-teardown.ts.template'),
      path.join(project.path, 'src/api/global-teardown.ts'),
      templateVariables,
    );

    // Generate cucumber.cjs
    await this.templateService.writeRenderedTemplate(
      TEMPLATE_FILES.CUCUMBER_CONFIG,
      path.join(project.path, 'cucumber.cjs'),
      templateVariables,
    );

    // Generate hooks.ts
    await this.templateService.writeRenderedTemplate(
      TEMPLATE_FILES.HOOKS,
      path.join(project.path, 'src/steps/hooks.ts'),
      templateVariables,
    );

    // Generate world.ts
    await this.templateService.writeRenderedTemplate(
      TEMPLATE_FILES.WORLD,
      path.join(project.path, 'src/steps/world.ts'),
      templateVariables,
    );

    // Generate common.ts
    await this.templateService.writeRenderedTemplate(
      path.join(__dirname, 'templates', 'common.ts.template'),
      path.join(project.path, 'src/types/common.ts'),
      templateVariables,
    );

    // Generate .env
    await this.templateService.writeRenderedTemplate(
      path.join(__dirname, 'templates', 'env.template'),
      path.join(project.path, '.env'),
      templateVariables,
    );

    // Modify existing README.md
    await this.templateService.writeRenderedTemplate(
      TEMPLATE_FILES.README,
      path.join(project.path, 'README.md'),
      templateVariables,
    );
  }

  /**
   * Updates the status of a project.
   * 
   * @param id - The unique identifier of the project
   * @param status - The new status to set
   * @returns Promise that resolves when the status is updated
   * @private
   */
  private async updateProjectStatus(
    id: string,
    status: ProjectStatus,
  ): Promise<void> {
    await this.projectRepo.update(id, { status });
  }
} 
