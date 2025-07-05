import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Project } from '../../projects/project.entity';
import { Endpoint } from '../endpoint.entity';
import { TemplateService } from '../../projects/services/template.service';

@Injectable()
export class HooksUpdaterService {
  private readonly logger = new Logger(HooksUpdaterService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Endpoint)
    private readonly endpointRepository: Repository<Endpoint>,
    private readonly templateService: TemplateService,
  ) {}

  /**
   * Regenerates the complete hooks.ts file based on all endpoints in the project
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
   * Updates the hooks.ts file when a new endpoint is added
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
   * Removes an endpoint from hooks.ts when deleted
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
   * Generates the complete hooks.ts file based on all endpoints
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
    this.logger.debug(`✅ hooks.ts generated with ${endpoints.length} endpoints`);
  }

  /**
   * Groups endpoints by section
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
   * Generates client declarations for the template
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
   * Generates entity storage declarations for the template
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
   * Generates imports for the template
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
   * Generates step imports for the template
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
