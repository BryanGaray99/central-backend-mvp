import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Delete,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { EndpointsService } from '../endpoints.service';
import { RegisterEndpointDto } from '../dto/register-endpoint.dto';
import { UpdateEndpointDto } from '../dto/update-endpoint.dto';

/**
 * Controller for managing endpoints within a specific project.
 * 
 * This controller provides endpoints for registering, listing, updating,
 * and deleting API endpoints within a specific project. It handles
 * project-scoped endpoint operations and artifact generation.
 * 
 * @class ProjectEndpointsController
 * @since 1.0.0
 */
@ApiTags('endpoints')
@Controller('projects/:projectId/endpoints')
export class ProjectEndpointsController {
  /** Logger instance for this controller */
  private readonly logger = new Logger(ProjectEndpointsController.name);

  /**
   * Creates an instance of ProjectEndpointsController.
   * 
   * @param endpointsService - The endpoints service for business logic
   */
  constructor(private readonly endpointsService: EndpointsService) {}

  /**
   * Registers and analyzes an endpoint to generate testing artifacts.
   * 
   * This endpoint analyzes a user-provided API endpoint and automatically
   * generates all necessary testing artifacts including features, steps,
   * fixtures, schemas, types, and API clients.
   * 
   * @param projectId - The ID of the project to register the endpoint in
   * @param dto - Endpoint registration data
   * @returns Promise that resolves to registration result
   * @throws {BadRequestException} When input data is invalid or API is not accessible
   * @throws {NotFoundException} When project is not found
   * 
   * @example
   * ```typescript
   * const result = await projectEndpointsController.registerAndAnalyze('project-id', {
   *   entityName: 'Product',
   *   path: '/products',
   *   methods: [{ method: 'GET' }, { method: 'POST' }]
   * });
   * ```
   */
  @Post()
  @ApiOperation({
    summary: 'Register and analyze an endpoint to generate testing artifacts',
    description:
      'Analyzes a user API endpoint and automatically generates all necessary testing artifacts (features, steps, fixtures, schemas, types, API client).',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: 'string' })
  @ApiResponse({
    status: 202,
    description: 'Analysis started successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            jobId: { type: 'string' },
            projectId: { type: 'string' },
            name: {
              type: 'string',
              description: 'Descriptive name of the endpoint',
            },
            endpointId: {
              type: 'string',
              description: 'Unique endpoint ID (UUID)',
            },
            message: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or API not accessible',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async registerAndAnalyze(
    @Param('projectId') projectId: string,
    @Body() dto: RegisterEndpointDto,
  ) {
    // Automatically inject projectId from path parameter
    dto.projectId = projectId;

    this.logger.log(
      `[CONTROLLER] Registering endpoint: ${dto.entityName} with ${dto.methods.length} methods in project: ${projectId}`,
    );

    const result = await this.endpointsService.registerAndAnalyze(dto);

    return {
      success: true,
      data: {
        jobId: result.jobId,
        projectId: projectId,
        name: result.name, // Descriptive name
        endpointId: result.id, // Real unique ID (UUID)
        message: `Analysis and generation for endpoint '${dto.entityName}' (${dto.methods.map((m) => m.method).join(', ')}) started successfully.`,
      },
    };
  }

  /**
   * Lists all registered endpoints for a specific project.
   * 
   * @param projectId - The ID of the project to list endpoints for
   * @returns Promise that resolves to an array of project endpoints
   * @throws {NotFoundException} When project is not found
   * 
   * @example
   * ```typescript
   * const endpoints = await projectEndpointsController.listEndpoints('project-id');
   * console.log(`Found ${endpoints.length} endpoints in project`);
   * ```
   */
  @Get()
  @ApiOperation({
    summary: 'List registered endpoints of a project',
    description:
      'Gets the list of all registered endpoints for a specific project.',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Endpoint list retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              endpointId: {
                type: 'string',
                description: 'Unique endpoint ID (UUID)',
              },
              name: {
                type: 'string',
                description: 'Descriptive name of the endpoint',
              },
              entityName: { type: 'string' },
              path: { type: 'string' },
              methods: { type: 'array', items: { type: 'string' } },
              section: { type: 'string' },
              status: { type: 'string' },
              createdAt: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async listEndpoints(@Param('projectId') projectId: string) {
    const endpoints = await this.endpointsService.listEndpoints(projectId);
      
    return endpoints.map((endpoint) => ({
      endpointId: endpoint.id, // Real unique ID (UUID)
      name: endpoint.name, // Descriptive name
      entityName: endpoint.entityName,
      path: endpoint.path,
      methods: endpoint.methods.map((m) => m.method),
      section: endpoint.section,
      status: endpoint.status,
      createdAt: endpoint.createdAt,
    }));
  }

  /**
   * Gets the complete details of a specific endpoint.
   * 
   * @param projectId - The ID of the project containing the endpoint
   * @param endpointId - The unique ID of the endpoint to retrieve
   * @returns Promise that resolves to the endpoint details
   * @throws {NotFoundException} When project or endpoint is not found
   * 
   * @example
   * ```typescript
   * const endpoint = await projectEndpointsController.getEndpoint('project-id', 'endpoint-id');
   * console.log(`Endpoint: ${endpoint.data.name}`);
   * ```
   */
  @Get(':endpointId')
  @ApiOperation({
    summary: 'Get details of a specific endpoint',
    description:
      'Gets the complete details of a registered endpoint, including analysis results and generated artifacts.',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: 'string' })
  @ApiParam({ name: 'endpointId', description: 'Unique endpoint ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Endpoint details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Project or endpoint not found' })
  async getEndpoint(
    @Param('projectId') projectId: string,
    @Param('endpointId') endpointId: string,
  ) {
    this.logger.log(
      `[CONTROLLER] Getting endpoint with ID: ${endpointId} from project: ${projectId}`,
    );

    const endpoint = await this.endpointsService.getEndpoint(
      endpointId,
      projectId,
    );
      
    return {
      success: true,
      data: endpoint,
    };
  }

  /**
   * Updates the metadata of a registered endpoint.
   * 
   * @param projectId - The ID of the project containing the endpoint
   * @param endpointId - The unique ID of the endpoint to update
   * @param dto - Endpoint update data
   * @returns Promise that resolves to the updated endpoint
   * @throws {NotFoundException} When project or endpoint is not found
   * 
   * @example
   * ```typescript
   * const updatedEndpoint = await projectEndpointsController.updateEndpoint(
   *   'project-id',
   *   'endpoint-id',
   *   { entityName: 'UpdatedEntity', description: 'New description' }
   * );
   * ```
   */
  @Patch(':endpointId')
  @ApiOperation({
    summary: 'Update endpoint metadata',
    description:
      'Updates the metadata of a registered endpoint (entityName, section, description).',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: 'string' })
  @ApiParam({ name: 'endpointId', description: 'Unique endpoint ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Endpoint updated successfully' })
  @ApiResponse({ status: 404, description: 'Project or endpoint not found' })
  async updateEndpoint(
    @Param('projectId') projectId: string,
    @Param('endpointId') endpointId: string,
    @Body() dto: UpdateEndpointDto,
  ) {
    this.logger.log(
      `[CONTROLLER] Updating endpoint with ID: ${endpointId} in project: ${projectId}`,
    );

    const updatedEndpoint = await this.endpointsService.updateEndpoint(
      endpointId,
      projectId,
      dto,
    );
      
    return {
      success: true,
      data: updatedEndpoint,
    };
  }

  /**
   * Deletes an endpoint and all its associated testing artifacts.
   * 
   * @param projectId - The ID of the project containing the endpoint
   * @param endpointId - The unique ID of the endpoint to delete
   * @returns Promise that resolves when deletion is complete
   * @throws {NotFoundException} When project or endpoint is not found
   * 
   * @example
   * ```typescript
   * const result = await projectEndpointsController.deleteEndpoint('project-id', 'endpoint-id');
   * console.log(result.message); // 'Endpoint and associated artifacts deleted successfully.'
   * ```
   */
  @Delete(':endpointId')
  @ApiOperation({
    summary: 'Delete an endpoint and its artifacts',
    description:
      'Deletes a registered endpoint and all its associated testing artifacts.',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: 'string' })
  @ApiParam({ name: 'endpointId', description: 'Unique endpoint ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Endpoint and artifacts deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Project or endpoint not found' })
  async deleteEndpoint(
    @Param('projectId') projectId: string,
    @Param('endpointId') endpointId: string,
  ) {
    this.logger.log(
      `[CONTROLLER] Deleting endpoint with ID: ${endpointId} from project: ${projectId}`,
    );

    await this.endpointsService.deleteEndpoint(endpointId, projectId);
      
    return {
      success: true,
      message: 'Endpoint and associated artifacts deleted successfully.',
    };
  }
} 