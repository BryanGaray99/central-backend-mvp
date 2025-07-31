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
              methods: { 
                type: 'array', 
                items: { 
                  type: 'object',
                  properties: {
                    method: { type: 'string' },
                    requestBodyDefinition: { 
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          type: { type: 'string' },
                          example: { type: 'any' },
                          validations: { type: 'object' }
                        }
                      }
                    },
                    description: { type: 'string' },
                    requiresAuth: { type: 'boolean' }
                  }
                } 
              },
              section: { type: 'string' },
              status: { type: 'string' },
              projectId: { type: 'string' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
              generatedArtifacts: { type: 'object' },
                                      analysisResults: { 
                  type: 'object',
                  additionalProperties: {
                    type: 'object',
                    properties: {
                      statusCode: { type: 'number' },
                      responseSchema: { type: 'object' },
                      responseFields: { 
                        type: 'array', 
                        items: {
                          type: 'object',
                          properties: {
                            name: { type: 'string' },
                            type: { type: 'string' },
                            required: { type: 'boolean' },
                            description: { type: 'string' },
                            example: { type: 'any' }
                          }
                        }
                      },
                      requiredFields: { type: 'array', items: { type: 'string' } },
                      dto: { type: 'object' },
                      example: { type: 'object' },
                      description: { type: 'string' },
                      contentType: { type: 'string' },
                      produces: { type: 'array', items: { type: 'string' } },
                      consumes: { type: 'array', items: { type: 'string' } }
                    }
                  }
                },
            },
          },
        },
      },
    },
  })
  async listAllEndpoints() {
    const endpoints = await this.endpointsService.listAllEndpoints();
      
    return endpoints.map((endpoint) => {
      // Usar los métodos de procesamiento del servicio
      const processedMethods = this.endpointsService.processMethods(endpoint.methods);
      const processedAnalysisResults = this.endpointsService.processAnalysisResults(endpoint.analysisResults);
      
      return {
        endpointId: endpoint.id, // Real unique ID (UUID)
        name: endpoint.name, // Descriptive name
        entityName: endpoint.entityName,
        path: endpoint.path,
        methods: processedMethods,
        section: endpoint.section,
        status: endpoint.status,
        projectId: endpoint.projectId,
        createdAt: endpoint.createdAt,
        updatedAt: endpoint.updatedAt,
        generatedArtifacts: endpoint.generatedArtifacts,
        analysisResults: processedAnalysisResults,
      };
    });
  }
}
