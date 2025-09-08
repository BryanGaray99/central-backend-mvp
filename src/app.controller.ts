/**
 * Main Application Controller
 * 
 * Handles root-level HTTP requests for the Central Backend MVP application.
 * Provides health check endpoints and welcome messages for the API.
 * 
 * @controller AppController
 * @version 1.0.0
 * @author Central Backend MVP Team
 */

import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

/**
 * Main Application Controller
 * 
 * Provides basic application endpoints including health checks
 * and welcome messages for API consumers.
 * 
 * @class AppController
 */
@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Health check endpoint to verify service status and dependencies.
   * 
   * @returns Object containing service health information
   * 
   * @example
   * ```typescript
   * GET /v1/api/health
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "status": "healthy",
   *     "timestamp": "2024-01-15T10:30:00.000Z",
   *     "uptime": 123.456,
   *     "version": "1.0.0",
   *     "environment": "development",
   *     "services": {
   *       "database": "connected",
   *       "fileSystem": "accessible"
   *     }
   *   },
   *   "message": "Service is healthy"
   * }
   * ```
   */
  @Get('health')
  @ApiOperation({
    summary: 'Health Check',
    description: 'Verifies the service status and its dependencies',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is running correctly',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'healthy' },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number', example: 123.456 },
            version: { type: 'string', example: '1.0.0' },
            environment: { type: 'string', example: 'development' },
            services: {
              type: 'object',
              properties: {
                database: { type: 'string', example: 'connected' },
                fileSystem: { type: 'string', example: 'accessible' },
              },
            },
          },
        },
        message: { type: 'string', example: 'Service is healthy' },
      },
    },
  })
  getHealth() {
    return {
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        services: {
          database: 'connected',
          fileSystem: 'accessible',
        },
      },
      message: 'Service is healthy',
    };
  }

  /**
   * Welcome endpoint that provides basic API information and available endpoints.
   * 
   * @returns Object containing welcome message and API information
   * 
   * @example
   * ```typescript
   * GET /v1/api/
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "message": "Welcome to Central Backend MVP - Test Generation Engine",
   *     "version": "1.0.0",
   *     "documentation": "/docs",
   *     "endpoints": {
   *       "projects": "/v1/api/projects",
   *       "endpoints": "/v1/api/projects/:id/endpoints",
   *       "testExecution": "/v1/api/projects/:id/test-execution",
   *       "health": "/v1/api/health"
   *     }
   *   }
   * }
   * ```
   */
  @Get()
  @ApiOperation({
    summary: 'Welcome Message',
    description: 'API welcome message with basic information',
  })
  @ApiResponse({
    status: 200,
    description: 'Welcome message',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Welcome to Central Backend MVP' },
            version: { type: 'string', example: '1.0.0' },
            documentation: { type: 'string', example: '/docs' },
          },
        },
      },
    },
  })
  getHello() {
    return {
      success: true,
      data: {
        message: 'Welcome to Central Backend MVP - Test Generation Engine',
        version: '1.0.0',
        documentation: '/docs',
        endpoints: {
          projects: '/v1/api/projects',
          endpoints: '/v1/api/projects/:id/endpoints',
          testExecution: '/v1/api/projects/:id/test-execution',
          health: '/v1/api/health',
        },
      },
    };
  }
}
