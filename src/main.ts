/**
 * Main Application Bootstrap
 * 
 * Central entry point for the Central Backend MVP application.
 * Configures NestJS application with security middleware, validation,
 * CORS, Swagger documentation, and automatic port detection.
 * 
 * @file main.ts
 * @version 1.0.0
 * @author Central Backend MVP Team
 */

// NOTE: If TypeScript errors related to Swagger or NestJS appear on Windows,
// it may be due to multiple node_modules in different paths. Restarting the IDE
// or cleaning node_modules may help.
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger, HttpStatus } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import * as dotenv from 'dotenv';
import * as net from 'net';
import * as compression from 'compression';
import helmet from 'helmet';

dotenv.config();

/**
 * Checks if a port is available for use.
 * 
 * @param port - The port number to check
 * @returns Promise<boolean> - True if port is available, false otherwise
 * 
 * @example
 * ```typescript
 * const available = await isPortAvailable(3000);
 * console.log(`Port 3000 is ${available ? 'available' : 'not available'}`);
 * ```
 */
async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.once('close', () => {
        resolve(true);
      });
      server.close();
    });
    server.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Finds an available port from a predefined list.
 * 
 * @returns Promise<number> - The first available port
 * @throws Error - If no ports are available
 * 
 * @example
 * ```typescript
 * try {
 *   const port = await findAvailablePort();
 *   console.log(`Using port: ${port}`);
 * } catch (error) {
 *   console.error('No available ports found');
 * }
 * ```
 */
async function findAvailablePort(): Promise<number> {
  const ports = [3000, 3001, 3002];

  for (const port of ports) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(
    'No available port found. Ports 3000, 3001 and 3002 are occupied.',
  );
}

/**
 * Bootstrap function that initializes and configures the NestJS application.
 * Sets up middleware, validation, CORS, Swagger documentation, and starts the server.
 * 
 * @returns Promise<void>
 * 
 * @example
 * ```typescript
 * bootstrap().catch((error) => {
 *   console.error('Failed to start application:', error);
 *   process.exit(1);
 * });
 * ```
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Configure global base path
  app.setGlobalPrefix('v1/api');

  // Security middleware
  app.use(helmet());
  app.use(compression());

  // Enable CORS with safer defaults (local only by default)
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : [/^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];
  app.enableCors({
    origin: corsOrigins as any,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count'],
    credentials: true,
    maxAge: 3600,
  });

  // Global DTO validation with enhanced options
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      skipMissingProperties: false,
      skipNullProperties: false,
      skipUndefinedProperties: false,
    }),
  );

  // Global filters and interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Enhanced Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Central Backend MVP - Test Generation Engine')
    .setDescription(
      `Central API for generation and orchestration of automated testing projects.`,
    )
    .setVersion('1.0.0')
    .addTag('projects', 'Testing project management')
    .addTag('endpoints', 'API endpoint registration and management')
    .addTag('test-execution', 'Test execution and results management')
    .addTag('health', 'Service status')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-API-KEY', in: 'header' }, 'X-API-KEY')
    .addServer('http://localhost:3000', 'Development Server')
    .addServer('http://localhost:3001', 'Alternative Server 1')
    .addServer('http://localhost:3002', 'Alternative Server 2')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
  // Configure Swagger with enhanced options
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      displayRequestDuration: true,
      filter: true,
      showRequestHeaders: true,
      showCommonExtensions: true,
    },
    customSiteTitle: 'Central Backend MVP - API Documentation',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #2c3e50; font-size: 2.5em; }
      .swagger-ui .info .description { font-size: 1.1em; line-height: 1.6; }
      .swagger-ui .scheme-container { background: #f8f9fa; padding: 10px; border-radius: 5px; }
    `,
  });

  try {
    const envPort = Number(process.env.PORT);
    const port = Number.isFinite(envPort) && envPort > 0 ? envPort : await findAvailablePort();
    const host = process.env.HOST || '127.0.0.1';
    await app.listen(port, host);
    
    logger.log(`🚀 Central Backend MVP running at: http://${host}:${port}`);
    logger.log(`📚 Swagger documentation at: http://${host}:${port}/docs`);
    logger.log(`🔒 API Version: v1`);
    logger.log(`🏥 Health Check at: http://${host}:${port}/v1/api/health`);
    logger.log(`🔗 Base Path: /v1/api`);
    logger.log(`📊 Available endpoints:`);
    logger.log(`   - Projects: http://${host}:${port}/v1/api/projects`);
    logger.log(`   - Endpoints: http://${host}:${port}/v1/api/endpoints`);
    logger.log(`   - Test Execution: http://${host}:${port}/v1/api/projects/:id/test-execution`);
  } catch (error) {
    logger.error('❌ Error starting server:', error.message);
    process.exit(1);
  }
}

// Start the application
bootstrap();
