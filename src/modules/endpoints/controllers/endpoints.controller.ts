import {
  Controller,
  Get,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EndpointsService } from '../endpoints.service';

@ApiTags('endpoints')
@Controller('endpoints')
export class EndpointsController {
  private readonly logger = new Logger(EndpointsController.name);

  constructor(private readonly endpointsService: EndpointsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all registered endpoints across all projects',
    description: 'Gets the list of all registered endpoints from all projects.',
  })
  @ApiResponse({
    status: 200,
    description: 'All endpoints retrieved successfully',
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
              projectId: { type: 'string' },
              createdAt: { type: 'string' },
            },
          },
        },
      },
    },
  })
  async listAllEndpoints() {
    const endpoints = await this.endpointsService.listAllEndpoints();
      
    return endpoints.map((endpoint) => ({
      endpointId: endpoint.id, // Real unique ID (UUID)
      name: endpoint.name, // Descriptive name
      entityName: endpoint.entityName,
      path: endpoint.path,
      methods: endpoint.methods.map((m) => m.method),
      section: endpoint.section,
      status: endpoint.status,
      projectId: endpoint.projectId,
      createdAt: endpoint.createdAt,
    }));
  }
}
