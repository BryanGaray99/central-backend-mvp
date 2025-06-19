import { Injectable, Logger } from '@nestjs/common';
import { Project, ProjectStatus } from './project.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as path from 'path';
import { FileSystemService } from './services/file-system.service';
import { TemplateService } from './services/template.service';
import { PlaywrightService } from './services/playwright.service';
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
  ) {}

  async generateProject(project: Project): Promise<void> {
    try {
      await this.updateProjectStatus(project.id, ProjectStatus.PENDING);
      
      // Inicializar proyecto Playwright (esto crea la estructura básica)
      await this.playwrightService.initializeProject(project);
      
      // Crear estructura adicional para BDD ANTES de generar archivos
      await this.fileSystemService.createDirectoryStructure(
        project.path,
        PROJECT_STRUCTURE,
      );
      
      // Generar/modificar archivos desde plantillas
      await this.generateProjectFiles(project);
      
      // Ejecutar health check antes de marcar como ready
      const isHealthy = await this.playwrightService.runHealthCheck(project);
      
      if (isHealthy) {
        await this.updateProjectStatus(project.id, ProjectStatus.READY);
      } else {
        throw new Error('Health check failed');
      }
    } catch (error) {
      this.logger.error(`Error generando proyecto ${project.name}: ${error.message}`);
      await this.updateProjectStatus(project.id, ProjectStatus.FAILED);
      throw error;
    }
  }

  private async generateProjectFiles(project: Project): Promise<void> {
    const templateVariables = {
      name: project.name,
      baseUrl: project.baseUrl,
      author: project.metadata?.author || '',
      description: project.metadata?.description || 'Proyecto de pruebas API con Playwright + BDD',
    };

    // Modificar package.json existente con nuestras configuraciones
    await this.templateService.writeRenderedTemplate(
      TEMPLATE_FILES.PACKAGE_JSON,
      path.join(project.path, 'package.json'),
      templateVariables,
    );

    // Modificar playwright.config.ts existente
    await this.templateService.writeRenderedTemplate(
      TEMPLATE_FILES.PLAYWRIGHT_CONFIG,
      path.join(project.path, 'playwright.config.ts'),
      templateVariables,
    );

    // Generar api.config.ts
    await this.templateService.writeRenderedTemplate(
      TEMPLATE_FILES.API_CONFIG,
      path.join(project.path, 'src/api/api.config.ts'),
      templateVariables,
    );

    // Modificar README.md existente
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