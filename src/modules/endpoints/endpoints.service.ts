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
import { TestCaseGenerationService } from '../test-cases/services/test-case-generation.service';
import { TestCasesService } from '../test-cases/services/test-cases.service';
import { TestStepRegistrationService } from '../test-cases/services/test-step-registration.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for managing API endpoints and their testing artifacts.
 * 
 * This service handles the complete lifecycle of endpoint management, including
 * registration, analysis, artifact generation, and cleanup. It coordinates
 * with various specialized services to provide comprehensive endpoint
 * management functionality.
 * 
 * @class EndpointsService
 * @since 1.0.0
 */
@Injectable()
export class EndpointsService {
  /** Logger instance for this service */
  private readonly logger = new Logger(EndpointsService.name);

  /**
   * Creates an instance of EndpointsService.
   * 
   * @param projectRepository - TypeORM repository for Project entity
   * @param endpointRepository - TypeORM repository for Endpoint entity
   * @param analysisService - Service for endpoint analysis
   * @param artifactsGenerationService - Service for artifact generation
   * @param hooksUpdaterService - Service for hooks file updates
   * @param apiConfigUpdaterService - Service for API config updates
   * @param cleanupService - Service for cleanup operations
   * @param testCaseGenerationService - Service for test case generation
   * @param testCasesService - Service for test cases management
   * @param testStepRegistrationService - Service for test step registration
   */
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
    private readonly testCaseGenerationService: TestCaseGenerationService,
    private readonly testCasesService: TestCasesService,
    private readonly testStepRegistrationService: TestStepRegistrationService,
  ) {}

  /**
   * Registers and analyzes an endpoint for test generation.
   * 
   * This method validates the endpoint data, creates the endpoint record,
   * and starts the analysis and generation process in the background.
   * 
   * @param dto - Endpoint registration data
   * @returns Promise that resolves to registration result
   * @throws {BadRequestException} When project ID is missing or endpoint already exists
   * @throws {NotFoundException} When project is not found
   * 
   * @example
   * ```typescript
   * const result = await endpointsService.registerAndAnalyze({
   *   projectId: 'project-id',
   *   entityName: 'Product',
   *   path: '/products',
   *   methods: [{ method: 'GET' }, { method: 'POST' }]
   * });
   * ```
   */
  async registerAndAnalyze(dto: RegisterEndpointDto) {
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

  /**
   * Lists all endpoints for a specific project.
   * 
   * @param projectId - The ID of the project to list endpoints for
   * @returns Promise that resolves to an array of endpoints
   * @throws {NotFoundException} When project is not found
   * 
   * @example
   * ```typescript
   * const endpoints = await endpointsService.listEndpoints('project-id');
   * console.log(`Found ${endpoints.length} endpoints`);
   * ```
   */
  async listEndpoints(projectId: string): Promise<Endpoint[]> {
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

  /**
   * Lists all endpoints across all projects.
   * 
   * @returns Promise that resolves to an array of all endpoints
   * 
   * @example
   * ```typescript
   * const allEndpoints = await endpointsService.listAllEndpoints();
   * console.log(`Found ${allEndpoints.length} endpoints across all projects`);
   * ```
   */
  async listAllEndpoints(): Promise<Endpoint[]> {
    return this.endpointRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Retrieves a specific endpoint by ID and project ID.
   * 
   * @param id - The unique ID of the endpoint
   * @param projectId - The ID of the project containing the endpoint
   * @returns Promise that resolves to the endpoint
   * @throws {NotFoundException} When project or endpoint is not found
   * 
   * @example
   * ```typescript
   * const endpoint = await endpointsService.getEndpoint('endpoint-id', 'project-id');
   * console.log(`Endpoint: ${endpoint.name}`);
   * ```
   */
  async getEndpoint(id: string, projectId: string): Promise<Endpoint> {
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

  /**
   * Processes and filters analysis results to return only relevant information
   * in Swagger-like format for each endpoint method.
   * 
   * @param analysisResults - Raw analysis results from endpoint analysis
   * @returns Processed analysis results with relevant fields
   * 
   * @example
   * ```typescript
   * const processed = endpointsService.processAnalysisResults(rawAnalysis);
   * console.log(processed.GET.statusCode); // 200
   * ```
   */
  public processAnalysisResults(analysisResults: any): any {
    if (!analysisResults) return null;

    const processedResults: any = {};

    for (const [method, analysis] of Object.entries(analysisResults)) {
      if (typeof analysis === 'object' && analysis !== null) {
        const analysisObj = analysis as any;
        const responseSchema = analysisObj.inferredResponseSchema || analysisObj.responseSchema || null;
        
        processedResults[method] = {
          statusCode: analysisObj.inferredStatusCode || analysisObj.statusCode || 200,
          responseFields: this.extractResponseFields(responseSchema),
          contentType: analysisObj.contentType || 'application/json',
        };
      }
    }

    return processedResults;
  }

  /**
   * Extracts response fields and their required status
   * to display concisely in the frontend.
   * 
   * @param responseSchema - The response schema to extract fields from
   * @returns Array of extracted response fields
   * @private
   */
  private extractResponseFields(responseSchema: any): any[] {
    if (!responseSchema || typeof responseSchema !== 'object') {
      return [];
    }

    const fields: any[] = [];

    // If it's an object with properties
    if (responseSchema.properties && typeof responseSchema.properties === 'object') {
      const requiredFields = responseSchema.required || [];
      
      // Look specifically for the 'data' field that contains the actual data
      if (responseSchema.properties.data) {
        const dataSchema = responseSchema.properties.data;
        
        // If data is an array, extract fields from items
        if (dataSchema.type === 'array' && dataSchema.items && dataSchema.items.properties) {
          const itemRequiredFields = dataSchema.items.required || [];
          
          for (const [fieldName, fieldSchema] of Object.entries(dataSchema.items.properties)) {
            const field = fieldSchema as any;
            fields.push({
              name: fieldName,
              type: field.type || 'unknown',
              required: itemRequiredFields.includes(fieldName),
              description: field.description || null,
              example: field.example || null,
            });
          }
        }
        // If data is an object, extract its fields directly
        else if (dataSchema.type === 'object' && dataSchema.properties) {
          const dataRequiredFields = dataSchema.required || [];
          
          for (const [fieldName, fieldSchema] of Object.entries(dataSchema.properties)) {
            const field = fieldSchema as any;
            fields.push({
              name: fieldName,
              type: field.type || 'unknown',
              required: dataRequiredFields.includes(fieldName),
              description: field.description || null,
              example: field.example || null,
            });
          }
        }
        // If data is a primitive type
        else {
          fields.push({
            name: 'data',
            type: dataSchema.type || 'unknown',
            required: requiredFields.includes('data'),
            description: 'Response data',
            example: null,
          });
        }
      } else {
        // If there's no 'data' field, extract all top-level fields
        for (const [fieldName, fieldSchema] of Object.entries(responseSchema.properties)) {
          const field = fieldSchema as any;
          fields.push({
            name: fieldName,
            type: field.type || 'unknown',
            required: requiredFields.includes(fieldName),
            description: field.description || null,
            example: field.example || null,
          });
        }
      }
    }
    // If it's an array, show information about the item type
    else if (responseSchema.type === 'array' && responseSchema.items) {
      if (responseSchema.items.properties) {
        const requiredFields = responseSchema.items.required || [];
        
        for (const [fieldName, fieldSchema] of Object.entries(responseSchema.items.properties)) {
          const field = fieldSchema as any;
          fields.push({
            name: fieldName,
            type: field.type || 'unknown',
            required: requiredFields.includes(fieldName),
            description: field.description || null,
            example: field.example || null,
          });
        }
      } else {
        fields.push({
          name: 'items',
          type: responseSchema.items.type || 'unknown',
          required: false,
          description: 'Array items',
          example: null,
        });
      }
    }
    // If it's a primitive type
    else {
      fields.push({
        name: 'response',
        type: responseSchema.type || 'unknown',
        required: false,
        description: 'Response data',
        example: null,
      });
    }

    return fields;
  }

  /**
   * Processes endpoint methods to include requestBodyDefinition
   * in Swagger-like format.
   * 
   * @param methods - Array of endpoint methods to process
   * @returns Processed methods with standardized format
   * 
   * @example
   * ```typescript
   * const processed = endpointsService.processMethods([
   *   { method: 'GET' },
   *   { method: 'POST', requestBodyDefinition: [...] }
   * ]);
   * ```
   */
  public processMethods(methods: any[]): any[] {
    if (!Array.isArray(methods)) return [];

    return methods.map(method => {
      if (typeof method === 'string') {
        return { method };
      }
      
      if (typeof method === 'object' && method !== null) {
        return {
          method: method.method,
          requestBodyDefinition: method.requestBodyDefinition || null,
          description: method.description || null,
          requiresAuth: method.requiresAuth || false,
        };
      }

      return method;
    });
  }

  /**
   * Updates an existing endpoint.
   * 
   * @param id - The unique ID of the endpoint to update
   * @param projectId - The ID of the project containing the endpoint
   * @param dto - Endpoint update data
   * @returns Promise that resolves to the updated endpoint
   * @throws {NotFoundException} When project or endpoint is not found
   * 
   * @example
   * ```typescript
   * const updated = await endpointsService.updateEndpoint(
   *   'endpoint-id',
   *   'project-id',
   *   { entityName: 'UpdatedEntity', description: 'New description' }
   * );
   * ```
   */
  async updateEndpoint(
    id: string,
    projectId: string,
    dto: UpdateEndpointDto,
  ): Promise<Endpoint> {
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

  /**
   * Deletes an endpoint and all its associated artifacts.
   * 
   * This method performs comprehensive cleanup including artifact files,
   * test cases, test steps, and configuration updates.
   * 
   * @param id - The unique ID of the endpoint to delete
   * @param projectId - The ID of the project containing the endpoint
   * @returns Promise that resolves when deletion is complete
   * @throws {NotFoundException} When project or endpoint is not found
   * 
   * @example
   * ```typescript
   * await endpointsService.deleteEndpoint('endpoint-id', 'project-id');
   * console.log('Endpoint and all artifacts deleted');
   * ```
   */
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
    const entityName = endpoint.entityName;
    const artifacts = endpoint.generatedArtifacts;

    // Delete artifact files and cleanup empty directories
    if (artifacts) {
      await this.cleanupService.cleanupEndpointArtifacts(project.path, artifacts, section, entityName);
    }

    // Delete test cases associated with this endpoint (by projectId, section and entityName)
    await this.testCasesService.deleteTestCasesByProjectSectionEntity(projectId, section, entityName);

    // Delete test steps associated with this endpoint (by projectId, section and entityName)
    await this.testStepRegistrationService.deleteTestStepsByProjectSectionEntity(projectId, section, entityName);

    // Delete endpoint record
    await this.endpointRepository.remove(endpoint);

    // Check if section is now empty and remove it if necessary
    await this.cleanupService.removeEmptySection(project.path, section);

    // Regenerate hooks.ts with remaining endpoints
    try {
      await this.hooksUpdaterService.regenerateHooksFile(project.id);
    } catch (error) {
      this.logger.warn(`Failed to update hooks.ts: ${error.message}`);
      // Don't fail the entire process if hooks.ts update fails
    }

    // Update api.config.ts after endpoint deletion
    await this.apiConfigUpdaterService.updateApiConfigOnEndpointDeletion(project.id);
  }

  /**
   * Processes an endpoint asynchronously through analysis and generation.
   * 
   * This method handles the complete endpoint processing pipeline including
   * analysis, artifact generation, and configuration updates.
   * 
   * @param endpoint - The endpoint to process
   * @param dto - Original endpoint registration data
   * @param project - The project containing the endpoint
   * @private
   */
  private async processEndpointAsync(
    endpoint: Endpoint,
    dto: RegisterEndpointDto,
    project: Project,
  ) {
    try {
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

      // Update hooks.ts with all endpoints FIRST - before generating artifacts
      if (endpoint.analysisResults) {
        try {
          await this.hooksUpdaterService.regenerateHooksFile(project.id);
        } catch (error) {
          this.logger.warn(`Failed to update hooks.ts: ${error.message}`);
        }
      }

      // Generate artifacts (types, schemas, fixtures, clients)
      await this.artifactsGenerationService.generate(
        project,
        dto,
        analysisResult,
      );

      // Generate test cases (features and steps)
      await this.testCaseGenerationService.generateTestCasesFromEndpoint(
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

      // Update api.config.ts with all endpoints - only if endpoint is ready
      if (endpoint.status === 'ready' && endpoint.analysisResults) {
        try {
          await this.apiConfigUpdaterService.updateApiConfigOnEndpointRegistration(project.id);
        } catch (error) {
          this.logger.warn(`Failed to update api.config.ts: ${error.message}`);
        }
      }
    } catch (error) {
      endpoint.status = 'failed';
      endpoint.errorMessage = error.message;
      await this.endpointRepository.save(endpoint);
    }
  }

  /**
   * Extracts DTO structure from request body definition.
   * 
   * @param requestBody - The request body definition to extract from
   * @param dtoType - Type of DTO to create ('create' or 'update')
   * @returns Extracted DTO structure
   * @private
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

    return dto;
  }

  /**
   * Maps JSON schema types to TypeScript types.
   * 
   * @param jsonType - The JSON schema type to map
   * @returns Corresponding TypeScript type
   * @private
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

  /**
   * Generates a unique endpoint name from the DTO data.
   * 
   * @param dto - The endpoint registration DTO
   * @returns Generated endpoint name
   * @private
   */
  private generateEndpointName(dto: RegisterEndpointDto): string {
    const baseId = `${dto.entityName.toLowerCase()}-${dto.methods.map((m) => m.method.toLowerCase()).join('-')}`;
    return baseId.replace(/[^a-z0-9-]/g, '-');
  }

  /**
   * Converts a string to kebab-case format.
   * 
   * @param str - The string to convert
   * @returns Kebab-case formatted string
   * @private
   */
  private kebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
  }

} 
