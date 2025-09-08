import {
  Controller,
  Get,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EndpointsService } from '../endpoints.service';

/**
 * Controller for managing endpoints across all projects.
 * 
 * This controller provides endpoints for listing and managing API endpoints
 * across all projects in the system. It handles global endpoint operations
 * and provides aggregated views of endpoint data.
 * 
 * @class EndpointsController
 * @since 1.0.0
 */
@ApiTags('endpoints')
@Controller('endpoints')
export class EndpointsController {
  /** Logger instance for this controller */
  private readonly logger = new Logger(EndpointsController.name);

  /**
   * Creates an instance of EndpointsController.
   * 
   * @param endpointsService - The endpoints service for business logic
   */
  constructor(private readonly endpointsService: EndpointsService) {}

  /**
   * Lists all registered endpoints across all projects.
   * 
   * This endpoint retrieves all endpoints from all projects in the system,
   * providing a comprehensive view of all registered API endpoints with
   * their analysis results and generated artifacts.
   * 
   * @returns Array of all endpoints with processed data
   * 
   * @example
   * ```typescript
   * const endpoints = await endpointsController.listAllEndpoints();
   * console.log(`Found ${endpoints.length} endpoints across all projects`);
   * ```
   */
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
      // Use service processing methods
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
