import { Injectable, Logger } from '@nestjs/common';
import { Project, ProjectStatus } from './project.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as path from 'path';
import { FileSystemService } from './services/file-system.service';
import { TemplateService } from './services/template.service';
import { PlaywrightService } from './services/playwright.service';
import { CleanupService } from './services/cleanup.service';
import { PROJECT_STRUCTURE, TEMPLATE_FILES } from './constants/project-structure';

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    private readonly fileSystemService: FileSystemService,
    private readonly templateService: TemplateService,
    private readonly playwrightService: PlaywrightService,
    private readonly cleanupService: CleanupService,
  ) {}

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
      this.logger.error(`Error generating project ${project.name}: ${error.message}`);
      await this.updateProjectStatus(project.id, ProjectStatus.FAILED);
      
      // Execute automatic cleanup in case of failure
      await this.cleanupService.cleanupFailedProject(project, error);
      
      throw error;
    }
  }

  private async generateProjectFiles(project: Project): Promise<void> {
    const templateVariables = {
      name: project.name,
      baseUrl: project.baseUrl,
      author: project.metadata?.author || '',
      description: project.metadata?.description || 'API testing project with Playwright + BDD',
    };

    // Modify existing package.json with our configurations
    await this.templateService.writeRenderedTemplate(
      TEMPLATE_FILES.PACKAGE_JSON,
      path.join(project.path, 'package.json'),
      templateVariables,
    );

    // Modify existing playwright.config.ts
    await this.templateService.writeRenderedTemplate(
      TEMPLATE_FILES.PLAYWRIGHT_CONFIG,
      path.join(project.path, 'playwright.config.ts'),
      templateVariables,
    );

    // Generate api.config.ts
    await this.templateService.writeRenderedTemplate(
      TEMPLATE_FILES.API_CONFIG,
      path.join(project.path, 'src/api/api.config.ts'),
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

    // Modify existing README.md
    await this.templateService.writeRenderedTemplate(
      TEMPLATE_FILES.README,
      path.join(project.path, 'README.md'),
      templateVariables,
    );
  }

  private async updateProjectStatus(id: string, status: ProjectStatus): Promise<void> {
    await this.projectRepo.update(id, { status });
  }
} 