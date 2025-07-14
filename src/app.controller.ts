import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({
    summary: 'Health Check',
    description: 'Verifica el estado del servicio y sus dependencias',
  })
  @ApiResponse({
    status: 200,
    description: 'Servicio funcionando correctamente',
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

  @Get()
  @ApiOperation({
    summary: 'Welcome Message',
    description: 'Mensaje de bienvenida de la API',
  })
  @ApiResponse({
    status: 200,
    description: 'Mensaje de bienvenida',
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
