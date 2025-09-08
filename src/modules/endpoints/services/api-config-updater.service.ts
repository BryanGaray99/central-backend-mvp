import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Endpoint } from '../endpoint.entity';
import { Project } from '../../projects/project.entity';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';

/**
 * Service responsible for updating the api.config.ts file in Playwright projects.
 * 
 * This service manages the generation and maintenance of the api.config.ts file
 * that contains all registered endpoints for a project. It extracts endpoint
 * information from the database, processes analysis results, and generates
 * TypeScript configuration files using Handlebars templates.
 * 
 * @class ApiConfigUpdaterService
 * @since 1.0.0
 */
@Injectable()
export class ApiConfigUpdaterService {
  private readonly logger = new Logger(ApiConfigUpdaterService.name);

  constructor(
    @InjectRepository(Endpoint)
    private readonly endpointRepository: Repository<Endpoint>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  /**
   * Updates the api.config.ts file for a project with all registered endpoints.
   * 
   * This method retrieves all endpoints for a project, processes their analysis results,
   * and generates a new api.config.ts file using Handlebars templates. The file is
   * written to the project's workspace directory.
   * 
   * @param projectId - The ID of the project to update the configuration for
   * @returns Promise that resolves when the configuration file has been updated
   * 
   * @example
   * ```typescript
   * await apiConfigUpdater.updateApiConfig('project-123');
   * ```
   */
  async updateApiConfig(projectId: string): Promise<void> {
    try {
      this.logger.log(`Updating api.config.ts for project ${projectId}`);

      // Get the project
      const project = await this.projectRepository.findOne({
        where: { id: projectId },
      });

      if (!project) {
        this.logger.warn(`Project ${projectId} not found`);
        return;
      }

      // Get all endpoints for the project
      const endpoints = await this.endpointRepository.find({
        where: { projectId },
        order: { entityName: 'ASC' },
      });

      // Prepare template data (even if there are no endpoints)
      const templateData = this.prepareTemplateData(project, endpoints);

      // Generate file content
      const apiConfigContent = await this.generateApiConfigContent(templateData);

      // Write file to project workspace root
      const apiConfigPath = path.join(project.path, 'api.config.ts');

      // Ensure directory exists
      const apiConfigDir = path.dirname(apiConfigPath);
      if (!fs.existsSync(apiConfigDir)) {
        fs.mkdirSync(apiConfigDir, { recursive: true });
      }

      // Write the file
      fs.writeFileSync(apiConfigPath, apiConfigContent, 'utf8');

      if (endpoints.length === 0) {
        this.logger.log(`api.config.ts updated (no endpoints) at ${apiConfigPath}`);
      } else {
        this.logger.log(`api.config.ts updated with ${endpoints.length} endpoints at ${apiConfigPath}`);
      }
    } catch (error) {
      this.logger.error(`Error updating api.config.ts: ${error.message}`, error.stack);
      // Don't throw the error to avoid failing the entire process
    }
  }

  /**
   * Prepares template data for the api.config.ts file generation.
   * 
   * This method processes endpoint data and analysis results to create a structured
   * data object that can be used with Handlebars templates. It extracts create and
   * update fields from analysis results and detects special features like address
   * fields and order status fields.
   * 
   * @private
   * @param project - The project configuration
   * @param endpoints - Array of endpoints to process
   * @returns Template data object with processed endpoint information
   */
  private prepareTemplateData(project: Project, endpoints: Endpoint[]): any {
    const endpointsData = endpoints.map(endpoint => {
      const entityName = endpoint.entityName;
      const entityLower = entityName.toLowerCase();
      const EntityName = entityName.charAt(0).toUpperCase() + entityName.slice(1);

      // Extract create and update fields from analysis
      const analysis = endpoint.analysisResults;
      
      // Check if analysis exists and has expected structure
      if (!analysis || typeof analysis !== 'object') {
        return {
          entityName,
          entityLower,
          EntityName,
          endpointPath: endpoint.path,
          createFields: [],
          updateFields: [],
        };
      }
      
      const createFields = this.extractCreateFields(analysis, entityName);
      const updateFields = this.extractUpdateFields(analysis, entityName);

      return {
        entityName,
        entityLower,
        EntityName,
        endpointPath: endpoint.path,
        createFields,
        updateFields,
      };
    });

    // Detect special features only if there are endpoints
    let hasAddress = false;
    let hasOrderStatus = false;

    if (endpoints.length > 0) {
      hasAddress = endpoints.some(endpoint => {
        const analysis = endpoint.analysisResults;
        if (!analysis || typeof analysis !== 'object') return false;
        return analysis?.POST?.inferredResponseSchema?.properties?.data?.properties?.address ||
               analysis?.GET?.inferredResponseSchema?.properties?.data?.properties?.address;
      });

      hasOrderStatus = endpoints.some(endpoint => {
        const analysis = endpoint.analysisResults;
        if (!analysis || typeof analysis !== 'object') return false;
        return endpoint.entityName.toLowerCase().includes('order') ||
               analysis?.POST?.inferredResponseSchema?.properties?.data?.properties?.status ||
               analysis?.GET?.inferredResponseSchema?.properties?.data?.properties?.status;
      });
    }

    const result = {
      baseUrl: project.baseUrl,
      basePath: project.basePath || '/v1/api',
      endpoints: endpointsData,
      hasAddress,
      hasOrderStatus,
    };

    return result;
  }

  /**
   * Extracts create fields from endpoint analysis results.
   * 
   * This method processes the POST method analysis to extract field definitions
   * that are used for creating new entities.
   * 
   * @private
   * @param analysis - The analysis results from endpoint exploration
   * @param entityName - The name of the entity being processed
   * @returns Array of field definitions for entity creation
   */
  private extractCreateFields(analysis: any, entityName: string): any[] {
    if (!analysis?.POST?.requestBodyDefinition) {
      return [];
    }

    return analysis.POST.requestBodyDefinition.map((field: any) => ({
      name: field.name,
      type: this.mapTypeToTs(field.type),
    }));
  }

  /**
   * Extracts update fields from endpoint analysis results.
   * 
   * This method processes the PATCH or PUT method analysis to extract field definitions
   * that are used for updating existing entities.
   * 
   * @private
   * @param analysis - The analysis results from endpoint exploration
   * @param entityName - The name of the entity being processed
   * @returns Array of field definitions for entity updates
   */
  private extractUpdateFields(analysis: any, entityName: string): any[] {
    const patchAnalysis = analysis?.PATCH;
    const putAnalysis = analysis?.PUT;
    const updateAnalysis = patchAnalysis || putAnalysis;

    if (!updateAnalysis?.requestBodyDefinition) {
      return [];
    }

    return updateAnalysis.requestBodyDefinition.map((field: any) => ({
      name: field.name,
      type: this.mapTypeToTs(field.type),
    }));
  }

  /**
   * Maps JSON schema types to TypeScript types.
   * 
   * This utility method converts JSON schema type definitions to their
   * corresponding TypeScript type representations.
   * 
   * @private
   * @param jsonType - The JSON schema type to convert
   * @returns The corresponding TypeScript type string
   */
  private mapTypeToTs(jsonType: string): string {
    switch (jsonType) {
      case 'string': return 'string';
      case 'number': return 'number';
      case 'integer': return 'number';
      case 'boolean': return 'boolean';
      case 'array': return 'any[]';
      case 'object': return 'Record<string, any>';
      default: return 'any';
    }
  }

  /**
   * Generates the api.config.ts file content using Handlebars templates.
   * 
   * This method reads the Handlebars template file, compiles it with the provided
   * data, and returns the generated TypeScript configuration content.
   * 
   * @private
   * @param templateData - The data to use for template compilation
   * @returns Promise resolving to the generated file content
   * @throws Error when template file cannot be read or compiled
   */
  private async generateApiConfigContent(templateData: any): Promise<string> {
    try {
      // Read the template
      const templatePath = path.join(__dirname, '..', 'templates', 'api.config.ts.template');
      const templateContent = fs.readFileSync(templatePath, 'utf8');

      // Compile the template
      const template = handlebars.compile(templateContent);

      // Generate the content
      return template(templateData);
    } catch (error) {
      this.logger.error(`Error generating api.config.ts content: ${error.message}`);
      throw error;
    }
  }

  /**
   * Updates the api.config.ts file when a new endpoint is registered.
   * 
   * This is a convenience method that triggers the configuration update
   * after endpoint registration.
   * 
   * @param projectId - The ID of the project to update
   * @returns Promise that resolves when the configuration has been updated
   */
  async updateApiConfigOnEndpointRegistration(projectId: string): Promise<void> {
    await this.updateApiConfig(projectId);
  }

  /**
   * Updates the api.config.ts file when an endpoint is deleted.
   * 
   * This is a convenience method that triggers the configuration update
   * after endpoint deletion.
   * 
   * @param projectId - The ID of the project to update
   * @returns Promise that resolves when the configuration has been updated
   */
  async updateApiConfigOnEndpointDeletion(projectId: string): Promise<void> {
    await this.updateApiConfig(projectId);
  }
} 