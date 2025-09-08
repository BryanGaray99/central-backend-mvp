import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Project } from '../../projects/project.entity';
import { Endpoint } from '../endpoint.entity';
import { TemplateService } from '../../projects/services/template.service';
import { CommonHooksRegistrationService } from '../../test-cases/services/common-hooks-registration.service';

/**
 * Service responsible for managing and updating Playwright hooks files.
 * 
 * This service handles the generation and maintenance of hooks.ts files in Playwright
 * projects. It manages client declarations, entity storage, imports, and integrates
 * with the common hooks registration system for database tracking.
 * 
 * @class HooksUpdaterService
 * @since 1.0.0
 */
@Injectable()
export class HooksUpdaterService {
  private readonly logger = new Logger(HooksUpdaterService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Endpoint)
    private readonly endpointRepository: Repository<Endpoint>,
    private readonly templateService: TemplateService,
    private readonly commonHooksRegistrationService: CommonHooksRegistrationService,
  ) {}

  /**
   * Regenerates the complete hooks.ts file based on all endpoints in the project.
   * 
   * This method retrieves all endpoints for a project and generates a new hooks.ts
   * file that includes all necessary client declarations, entity storage, and imports.
   * 
   * @param projectId - The ID of the project to regenerate hooks for
   * @returns Promise that resolves when the hooks file has been regenerated
   * @throws Error when project is not found or hooks generation fails
   * 
   * @example
   * ```typescript
   * await hooksUpdater.regenerateHooksFile('project-123');
   * ```
   */
  async regenerateHooksFile(projectId: string): Promise<void> {
    try {
      const project = await this.projectRepository.findOne({ where: { id: projectId } });
      if (!project) {
        throw new Error(`Project with ID ${projectId} not found`);
      }

      const endpoints = await this.endpointRepository.find({ 
        where: { projectId },
        order: { section: 'ASC', entityName: 'ASC' }
      });

      await this.generateHooksFile(project.path, endpoints);
      this.logger.log(`✅ hooks.ts regenerated for project ${project.name} with ${endpoints.length} endpoints`);
    } catch (error) {
      this.logger.error(`Error regenerating hooks.ts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Updates the hooks.ts file when a new endpoint is added.
   * 
   * This method triggers a complete regeneration of the hooks.ts file to include
   * the newly added endpoint. It finds the project by path and regenerates the
   * entire hooks file with all current endpoints.
   * 
   * @param projectPath - The path of the Playwright project
   * @param entityName - The name of the entity being added
   * @param section - The section/category of the entity
   * @returns Promise that resolves when the hooks file has been updated
   * @throws Error when project is not found or hooks update fails
   * 
   * @example
   * ```typescript
   * await hooksUpdater.updateHooksFile('/project/path', 'Product', 'ecommerce');
   * ```
   */
  async updateHooksFile(projectPath: string, entityName: string, section: string): Promise<void> {
    try {
      // Get all endpoints for the project to regenerate the complete file
      const project = await this.projectRepository.findOne({ where: { path: projectPath } });
      if (!project) {
        throw new Error(`Project not found for path: ${projectPath}`);
      }

      await this.regenerateHooksFile(project.id);
    } catch (error) {
      this.logger.error(`Error updating hooks.ts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Removes an endpoint from hooks.ts when deleted.
   * 
   * This method triggers a complete regeneration of the hooks.ts file to remove
   * the deleted endpoint. It finds the project by path and regenerates the
   * entire hooks file with the remaining endpoints.
   * 
   * @param projectPath - The path of the Playwright project
   * @param entityName - The name of the entity being removed
   * @param section - The section/category of the entity
   * @returns Promise that resolves when the hooks file has been updated
   * @throws Error when project is not found or hooks update fails
   * 
   * @example
   * ```typescript
   * await hooksUpdater.removeFromHooksFile('/project/path', 'Product', 'ecommerce');
   * ```
   */
  async removeFromHooksFile(projectPath: string, entityName: string, section: string): Promise<void> {
    try {
      // Get all endpoints for the project to regenerate the complete file
      const project = await this.projectRepository.findOne({ where: { path: projectPath } });
      if (!project) {
        throw new Error(`Project not found for path: ${projectPath}`);
      }

      await this.regenerateHooksFile(project.id);
    } catch (error) {
      this.logger.error(`Error removing from hooks.ts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generates the complete hooks.ts file based on all endpoints.
   * 
   * This private method creates the hooks.ts file by grouping endpoints by section,
   * generating template variables for clients, entities, and imports, and using
   * the template service to render the final file content.
   * 
   * @private
   * @param projectPath - The path of the Playwright project
   * @param endpoints - Array of endpoints to include in the hooks file
   * @returns Promise that resolves when the hooks file has been generated
   */
  private async generateHooksFile(projectPath: string, endpoints: Endpoint[]): Promise<void> {
    const hooksPath = path.join(projectPath, 'src', 'steps', 'hooks.ts');
    
    // Group endpoints by section
    const endpointsBySection = this.groupEndpointsBySection(endpoints);
    
    // Prepare template variables
    const templateVariables = {
      clients: this.generateClientDeclarations(endpointsBySection),
      entities: this.generateEntityStorage(endpointsBySection),
      imports: this.generateImports(endpointsBySection),
    };

    // Generate the complete hooks file
    const hooksContent = await this.templateService.renderTemplate(
      'hooks.ts.template',
      templateVariables
    );

    // Write the file
    fs.writeFileSync(hooksPath, hooksContent, 'utf8');

    // Register common hooks in the database
    try {
      const project = await this.projectRepository.findOne({ where: { path: projectPath } });
      if (project) {
        await this.commonHooksRegistrationService.updateCommonHooks(project.id, hooksPath);
        this.logger.log(`✅ Common hooks registered in database for project ${project.name}`);
      }
    } catch (error) {
      this.logger.error(`Error registering common hooks: ${error.message}`);
      // No throw error here to avoid breaking the hooks file generation
    }
  }

  /**
   * Groups endpoints by section for organized template processing.
   * 
   * This private method organizes endpoints into a dictionary structure
   * where each section contains an array of its associated endpoints.
   * 
   * @private
   * @param endpoints - Array of endpoints to group
   * @returns Record mapping section names to arrays of endpoints
   */
  private groupEndpointsBySection(endpoints: Endpoint[]): Record<string, Endpoint[]> {
    const grouped: Record<string, Endpoint[]> = {};
    
    for (const endpoint of endpoints) {
      if (!grouped[endpoint.section]) {
        grouped[endpoint.section] = [];
      }
      grouped[endpoint.section].push(endpoint);
    }
    
    return grouped;
  }

  /**
   * Generates client declarations for the hooks template.
   * 
   * This private method creates client declaration objects for each endpoint
   * that will be used in the hooks template to declare API client instances.
   * 
   * @private
   * @param endpointsBySection - Endpoints grouped by section
   * @returns Array of client declaration objects for template processing
   */
  private generateClientDeclarations(endpointsBySection: Record<string, Endpoint[]>): any[] {
    const clients: any[] = [];
    
    for (const [section, endpoints] of Object.entries(endpointsBySection)) {
      for (const endpoint of endpoints) {
        clients.push({
          clientName: `${endpoint.entityName.toLowerCase()}Client`,
          clientType: `${endpoint.entityName}Client`,
          section: section,
          entityName: endpoint.entityName,
        });
      }
    }
    
    return clients;
  }

  /**
   * Generates entity storage declarations for the hooks template.
   * 
   * This private method creates entity storage objects for each endpoint
   * that will be used in the hooks template to manage entity data storage
   * during test execution.
   * 
   * @private
   * @param endpointsBySection - Endpoints grouped by section
   * @returns Array of entity storage objects for template processing
   */
  private generateEntityStorage(endpointsBySection: Record<string, Endpoint[]>): any[] {
    const entities: any[] = [];
    
    for (const [section, endpoints] of Object.entries(endpointsBySection)) {
      for (const endpoint of endpoints) {
        entities.push({
          pluralName: `${endpoint.entityName}s`,
          singularName: endpoint.entityName,
          entityName: endpoint.entityName,
          section: section,
          clientName: `${endpoint.entityName.toLowerCase()}Client`,
        });
      }
    }
    
    return entities;
  }

  /**
   * Generates import statements for the hooks template.
   * 
   * This private method creates import statements for all API client classes
   * that will be used in the hooks file to import the necessary client modules.
   * 
   * @private
   * @param endpointsBySection - Endpoints grouped by section
   * @returns Array of import statement strings for template processing
   */
  private generateImports(endpointsBySection: Record<string, Endpoint[]>): string[] {
    const imports: string[] = [];
    
    for (const [section, endpoints] of Object.entries(endpointsBySection)) {
      for (const endpoint of endpoints) {
        imports.push(`import { ${endpoint.entityName}Client } from '../api/${section}/${endpoint.entityName.toLowerCase()}.client';`);
      }
    }
    
    return imports;
  }

  /**
   * Generates step import statements for the hooks template.
   * 
   * This private method creates import statements for all step definition files
   * that will be used in the hooks file to import the necessary step modules.
   * 
   * @private
   * @param endpointsBySection - Endpoints grouped by section
   * @returns Array of step import statement strings for template processing
   */
  private generateStepImports(endpointsBySection: Record<string, Endpoint[]>): string[] {
    const imports: string[] = [];
    
    for (const [section, endpoints] of Object.entries(endpointsBySection)) {
      for (const endpoint of endpoints) {
        imports.push(`import '../${section}/${endpoint.entityName.toLowerCase()}.steps';`);
      }
    }
    
    return imports;
  }
}
