import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../projects/project.entity';
import { Endpoint } from './endpoint.entity';
import { RegisterEndpointDto } from './dto/register-endpoint.dto';
import { UpdateEndpointDto } from './dto/update-endpoint.dto';
import { AnalysisService } from './services/analysis.service';
import { ArtifactsGenerationService } from './services/artifacts-generation.service';
import { HooksUpdaterService } from './services/hooks-updater.service';
import { ApiConfigUpdaterService } from './services/api-config-updater.service';
import { CleanupService } from './services/cleanup.service';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs/promises';

@Injectable()
export class EndpointsService {
  private readonly logger = new Logger(EndpointsService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Endpoint)
    private readonly endpointRepository: Repository<Endpoint>,
    private readonly analysisService: AnalysisService,
    private readonly artifactsGenerationService: ArtifactsGenerationService,
    private readonly hooksUpdaterService: HooksUpdaterService,
    private readonly apiConfigUpdaterService: ApiConfigUpdaterService,
    private readonly cleanupService: CleanupService,
  ) {}

  async registerAndAnalyze(dto: RegisterEndpointDto) {
    // this.logger.log(
    //   `[SERVICE] Iniciando registro y análisis para endpoint: ${dto.entityName}`,
    // );

    // Validate projectId is present
    if (!dto.projectId) {
      throw new BadRequestException('Project ID is required');
    }

    // Validate project exists
    const project = await this.projectRepository.findOneBy({
      id: dto.projectId,
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${dto.projectId} not found`);
    }

    // Generate name if not provided
    const name = dto.name || this.generateEndpointName(dto);

    // Check if endpoint already exists
    const existingEndpoint = await this.endpointRepository.findOne({
      where: { name, projectId: dto.projectId },
    });

    if (existingEndpoint) {
      throw new BadRequestException(
        `Endpoint with name ${name} already exists for this project`,
      );
    }

    // Create endpoint record
    const endpoint = this.endpointRepository.create({
      name,
      projectId: dto.projectId,
      section: dto.section,
      entityName: dto.entityName,
      path: dto.path,
      methods: dto.methods,
      pathParameters: dto.pathParameters,
      description: dto.description,
      status: 'pending',
    });

    const savedEndpoint = await this.endpointRepository.save(endpoint);

    // Start analysis and generation in background
    this.processEndpointAsync(savedEndpoint, dto, project);

    return { 
      jobId: uuidv4(),
      name,
      id: savedEndpoint.id,
        projectId: dto.projectId,
      message: `Analysis and generation started for endpoint ${name}`,
    };
  }

  async listEndpoints(projectId: string): Promise<Endpoint[]> {
    // this.logger.log(`[SERVICE] Listando endpoints para proyecto: ${projectId}`);

    // Validate project exists
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    return this.endpointRepository.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
  }

  async getEndpoint(id: string, projectId: string): Promise<Endpoint> {
    // this.logger.log(
    //   `[SERVICE] Obteniendo endpoint con ID: ${id} del proyecto: ${projectId}`,
    // );

    // Validate project exists
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const endpoint = await this.endpointRepository.findOne({
      where: { id, projectId },
    });

    if (!endpoint) {
      throw new NotFoundException(`Endpoint with ID ${id} not found`);
    }

    return endpoint;
  }

  async updateEndpoint(
    id: string,
    projectId: string,
    dto: UpdateEndpointDto,
  ): Promise<Endpoint> {
    // this.logger.log(
    //   `[SERVICE] Actualizando endpoint con ID: ${id} del proyecto: ${projectId}`,
    // );

    // Validate project exists
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const endpoint = await this.endpointRepository.findOne({
      where: { id, projectId },
    });

    if (!endpoint) {
      throw new NotFoundException(`Endpoint with ID ${id} not found`);
    }

    // Update allowed fields
    if (dto.entityName) {
      endpoint.entityName = dto.entityName;
    }
    if (dto.section) {
      endpoint.section = dto.section;
    }
    if (dto.description) {
      endpoint.description = dto.description;
    }

    return this.endpointRepository.save(endpoint);
  }

  async deleteEndpoint(id: string, projectId: string): Promise<void> {
    // Validate project exists
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const endpoint = await this.endpointRepository.findOne({
      where: { id, projectId },
    });

    if (!endpoint) {
      throw new NotFoundException(`Endpoint with ID ${id} not found`);
    }

    // Store section info before deletion
    const section = endpoint.section;
    const artifacts = endpoint.generatedArtifacts;

    // Delete artifact files and cleanup empty directories
    if (artifacts) {
      await this.cleanupService.cleanupEndpointArtifacts(project.path, artifacts, section);
    }

    // Update project-meta.json to remove the endpoint entry
    await this.removeFromProjectMeta(project.path, endpoint);

    // Clean up hooks file
    await this.hooksUpdaterService.removeFromHooksFile(project.path, endpoint.entityName, endpoint.section);

    // Delete endpoint record
    await this.endpointRepository.remove(endpoint);

    // Check if section is now empty and remove it if necessary
    await this.cleanupService.removeEmptySection(project.path, section);

    // Update api.config.ts after endpoint deletion
    await this.apiConfigUpdaterService.updateApiConfigOnEndpointDeletion(project.id);
  }

  private async processEndpointAsync(
    endpoint: Endpoint,
    dto: RegisterEndpointDto,
    project: Project,
  ) {
    try {
      // this.logger.log(
      //   `[SERVICE] Procesando endpoint ${endpoint.name} en background`,
      // );

      // Update status to analyzing
      endpoint.status = 'analyzing';
      await this.endpointRepository.save(endpoint);

      // Analyze endpoint
      const analysisResult = await this.analysisService.analyzeEndpoint(
        project,
        dto,
      );

      // Update endpoint with analysis results
      endpoint.analysisResults = analysisResult.analysisResults;
      endpoint.status = 'generating';
      await this.endpointRepository.save(endpoint);

      // Generate artifacts
      await this.artifactsGenerationService.generate(
        project,
        dto,
        analysisResult,
      );

      // Update endpoint with generated artifacts info
      endpoint.generatedArtifacts = {
        feature: `src/features/${dto.section}/${this.kebabCase(dto.entityName)}.feature`,
        steps: `src/steps/${dto.section}/${this.kebabCase(dto.entityName)}.steps.ts`,
        fixture: `src/fixtures/${dto.section}/${this.kebabCase(dto.entityName)}.fixture.ts`,
        schema: `src/schemas/${dto.section}/${this.kebabCase(dto.entityName)}.schema.ts`,
        types: `src/types/${dto.section}/${this.kebabCase(dto.entityName)}.ts`,
        client: `src/api/${dto.section}/${this.kebabCase(dto.entityName)}.client.ts`,
      };
      endpoint.status = 'ready';
      await this.endpointRepository.save(endpoint);

      // Update project-meta.json
      await this.updateProjectMeta(project.path, endpoint, dto, analysisResult);

      // Update api.config.ts with all endpoints - only if endpoint is ready
      if (endpoint.status === 'ready' && endpoint.analysisResults) {
        try {
          await this.apiConfigUpdaterService.updateApiConfigOnEndpointRegistration(project.id);
        } catch (error) {
          this.logger.warn(`Failed to update api.config.ts: ${error.message}`);
          // Don't fail the entire process if api.config.ts update fails
        }
      }

      // this.logger.log(
      //   `[SERVICE] Endpoint ${endpoint.name} procesado exitosamente`,
      // );
    } catch (error) {
      // this.logger.error(
      //   `[SERVICE] Error procesando endpoint ${endpoint.name}:`,
      //   error,
      // );

      endpoint.status = 'failed';
      endpoint.errorMessage = error.message;
      await this.endpointRepository.save(endpoint);
    }
  }

  private async updateProjectMeta(
    projectPath: string,
    endpoint: Endpoint,
    dto: RegisterEndpointDto,
    analysisResult: any,
  ) {
    try {
      const metaPath = path.join(projectPath, 'project-meta.json');

      // Read existing meta file
      let metaContent;
      try {
        const metaFile = await fs.readFile(metaPath, 'utf8');
        metaContent = JSON.parse(metaFile);
      } catch (error) {
        // If file doesn't exist or is invalid, create default structure
        metaContent = {
          endpoints: [],
          testCases: [],
          executions: [],
        };
      }

      // Check if endpoint already exists (same entity, path, and section)
      const existingEndpointIndex = metaContent.endpoints.findIndex(
        (ep: any) =>
          ep.entityName === dto.entityName &&
          ep.path === dto.path &&
          ep.section === dto.section,
      );

      // Process all methods that were analyzed
      const methodEntries: any[] = [];
      for (const methodConfig of dto.methods) {
        const method = methodConfig.method;
        const methodAnalysis = analysisResult.analysisResults?.[method];

        if (methodAnalysis) {
          const methodEntry: any = {
            method: method,
            generatedArtifacts: endpoint.generatedArtifacts,
            lastAnalysis: {
              timestamp: new Date().toISOString(),
              inferredStatusCode: methodAnalysis.inferredStatusCode || 200,
              inferredDataPath: methodAnalysis.inferredDataPath || '',
            },
          };

          // Only create DTOs according to HTTP method
          if (method === 'POST' && methodAnalysis.requestBodyDefinition) {
            methodEntry.createDto = this.extractDtoFromRequestBody(
              methodAnalysis.requestBodyDefinition, 
              'create'
            );
            // Log to see extracted DTO
            // this.logger.log(`[DEBUG] createDto extracted for ${dto.entityName} (POST):`, JSON.stringify(methodEntry.createDto, null, 2));
          } else if ((method === 'PATCH' || method === 'PUT') && methodAnalysis.requestBodyDefinition) {
            methodEntry.updateDto = this.extractDtoFromRequestBody(
              methodAnalysis.requestBodyDefinition, 
              'update'
            );
            // Log to see extracted DTO
            // this.logger.log(`[DEBUG] updateDto extracted for ${dto.entityName} (${method}):`, JSON.stringify(methodEntry.updateDto, null, 2));
          }
          // GET/DELETE: No DTOs

          methodEntries.push(methodEntry);
        }
      }

      if (existingEndpointIndex >= 0) {
        const existingEndpoint = metaContent.endpoints[existingEndpointIndex];
        if (!existingEndpoint.methods) {
          existingEndpoint.methods = [];
        }
        existingEndpoint.type = dto.entityName;
        delete existingEndpoint.fields;
        delete existingEndpoint.validations;
        delete existingEndpoint.createDto;
        delete existingEndpoint.updateDto;
        for (const methodEntry of methodEntries) {
          const existingMethodIndex = existingEndpoint.methods.findIndex(
            (m: any) => m.method === methodEntry.method,
          );
          if (existingMethodIndex >= 0) {
            existingEndpoint.methods[existingMethodIndex] = methodEntry;
          } else {
            existingEndpoint.methods.push(methodEntry);
          }
        }
      } else {
        const newEndpointEntry = {
          id: endpoint.id,
        entityName: dto.entityName,
        path: dto.path,
        section: dto.section,
          type: dto.entityName,
          methods: methodEntries,
        };
        metaContent.endpoints.push(newEndpointEntry);
      }

      // Write updated meta file
      await fs.writeFile(
        metaPath,
        JSON.stringify(metaContent, null, 2),
        'utf8',
      );

      // Comentado: logs de debug antiguos
      // this.logger.log(
      //   `[SERVICE] Project meta updated for endpoint ${endpoint.name} with conditional DTOs`,
      // );
    } catch (error) {
      // Comentado: logs de debug antiguos
      // this.logger.error(
      //   `[SERVICE] Error updating project meta:`,
      //   error.message,
      // );
    }
  }

  /**
   * Extrae DTO del request body con sus validaciones
   * ✅ CORREGIDO: Usa la misma lógica que TemplateVariablesService.mapInputField()
   */
  private extractDtoFromRequestBody(requestBody: any, dtoType: 'create' | 'update'): any {
    const dto: any = {};

    if (!requestBody) {
      return dto;
    }

    if (Array.isArray(requestBody)) {
      for (const field of requestBody) {
        if (field && field.name) {
          const isCreate = dtoType === 'create';
          const required = isCreate ? (field.validations?.required === true) : false;
          dto[field.name] = {
            type: this.mapJsonTypeToTypeScript(field.type || 'string'),
            required: required,
            nullable: field.validations?.nullable || false,
          };
          if (field.validations) {
            const validations: any = {};
            if (field.validations.minLength !== undefined) {
              validations.minLength = field.validations.minLength;
            }
            if (field.validations.maxLength !== undefined) {
              validations.maxLength = field.validations.maxLength;
            }
            if (field.validations.minimum !== undefined) {
              validations.minimum = field.validations.minimum;
            }
            if (field.validations.maximum !== undefined) {
              validations.maximum = field.validations.maximum;
            }
            if (field.validations.pattern !== undefined) {
              validations.pattern = field.validations.pattern;
            }
            if (field.validations.format !== undefined) {
              validations.format = field.validations.format;
            }
            if (field.validations.enum !== undefined) {
              validations.enum = field.validations.enum;
            }
            if (field.validations.default !== undefined) {
              validations.default = field.validations.default;
            }
            if (Object.keys(validations).length > 0) {
              dto[field.name].validations = validations;
            }
          }
        }
      }
    } else if (typeof requestBody === 'object') {
      if (requestBody.properties) {
        for (const [fieldName, fieldSchema] of Object.entries(requestBody.properties)) {
          const field = fieldSchema as any;
          dto[fieldName] = {
            type: this.mapJsonTypeToTypeScript(field.type || 'string'),
            required: dtoType === 'create' ? 
              (requestBody.required?.includes(fieldName) || false) : 
              false,
            nullable: field.nullable || false,
          };
          const validations: any = {};
          if (field.minLength !== undefined) validations.minLength = field.minLength;
          if (field.maxLength !== undefined) validations.maxLength = field.maxLength;
          if (field.minimum !== undefined) validations.minimum = field.minimum;
          if (field.maximum !== undefined) validations.maximum = field.maximum;
          if (field.pattern !== undefined) validations.pattern = field.pattern;
          if (field.format !== undefined) validations.format = field.format;
          if (field.enum !== undefined) validations.enum = field.enum;
          if (field.default !== undefined) validations.default = field.default;
          if (Object.keys(validations).length > 0) {
            dto[fieldName].validations = validations;
          }
        }
      } else {
        for (const [fieldName, fieldInfo] of Object.entries(requestBody)) {
          const field = fieldInfo as any;
          dto[fieldName] = {
            type: this.mapJsonTypeToTypeScript(field.type || 'string'),
            required: dtoType === 'create' ? (field.required !== false) : false,
            nullable: field.nullable || false,
          };
          const validations: any = {};
          if (field.minLength !== undefined) validations.minLength = field.minLength;
          if (field.maxLength !== undefined) validations.maxLength = field.maxLength;
          if (field.minimum !== undefined) validations.minimum = field.minimum;
          if (field.maximum !== undefined) validations.maximum = field.maximum;
          if (field.pattern !== undefined) validations.pattern = field.pattern;
          if (field.format !== undefined) validations.format = field.format;
          if (field.enum !== undefined) validations.enum = field.enum;
          if (field.default !== undefined) validations.default = field.default;
          if (Object.keys(validations).length > 0) {
            dto[fieldName].validations = validations;
          }
        }
      }
    }

    // Comentado: logs de debug antiguos
    // this.logger.log(`[SERVICE] Extracted ${Object.keys(dto).length} fields for ${dtoType}Dto`);
    return dto;
  }

  /**
   * Mapea tipos JSON Schema a TypeScript
   */
  private mapJsonTypeToTypeScript(jsonType: string): string {
    const typeMap: { [key: string]: string } = {
      'string': 'string',
      'number': 'number',
      'integer': 'number',
      'boolean': 'boolean',
      'array': 'any[]',
      'object': 'object',
    };
    
    return typeMap[jsonType] || 'any';
  }

  private generateEndpointName(dto: RegisterEndpointDto): string {
    const baseId = `${dto.entityName.toLowerCase()}-${dto.methods.map((m) => m.method.toLowerCase()).join('-')}`;
    return baseId.replace(/[^a-z0-9-]/g, '-');
  }

  private kebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
  }

  private async removeFromProjectMeta(
    projectPath: string,
    endpoint: Endpoint,
  ): Promise<void> {
    try {
      const metaPath = path.join(projectPath, 'project-meta.json');

      // Read existing meta file
      let metaContent;
      try {
        const metaFile = await fs.readFile(metaPath, 'utf8');
        metaContent = JSON.parse(metaFile);
      } catch (error) {
        return;
      }

      // Find and remove the endpoint entry by entityName, path, and section
      const existingEndpointIndex = metaContent.endpoints.findIndex(
        (ep: any) => 
          ep.entityName === endpoint.entityName &&
          ep.path === endpoint.path &&
          ep.section === endpoint.section,
      );

      if (existingEndpointIndex >= 0) {
        // Remove endpoint entry
        metaContent.endpoints.splice(existingEndpointIndex, 1);

        // Write updated meta file
        await fs.writeFile(
          metaPath,
          JSON.stringify(metaContent, null, 2),
          'utf8',
        );
      }
    } catch (error) {
      // Silently handle errors
    }
  }
}
