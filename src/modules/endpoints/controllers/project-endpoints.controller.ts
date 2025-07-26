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

@ApiTags('endpoints')
@Controller('projects/:projectId/endpoints')
export class ProjectEndpointsController {
  private readonly logger = new Logger(ProjectEndpointsController.name);

  constructor(private readonly endpointsService: EndpointsService) {}

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