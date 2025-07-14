// NOTA: Si aparecen errores de tipos relacionados con Swagger o NestJS en Windows, puede deberse a múltiples node_modules en rutas diferentes. Reiniciar el IDE o limpiar node_modules puede ayudar.
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

async function findAvailablePort(): Promise<number> {
  const ports = [3000, 3001, 3002];

  for (const port of ports) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(
    'No se encontró un puerto disponible. Puertos 3000, 3001 y 3002 están ocupados.',
  );
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Configurar base path global
  app.setGlobalPrefix('v1/api');

  // Security middleware
  app.use(helmet());
  app.use(compression());

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
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
        enableImplicitConversion: false,
      },
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      skipMissingProperties: false,
      skipNullProperties: false,
      skipUndefinedProperties: false,
    }),
  );

  // Filtros e interceptores globales
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Configuración de Swagger mejorada
  const config = new DocumentBuilder()
    .setTitle('Central Backend MVP - Test Generation Engine')
    .setDescription(
      `API central para generación y orquestación de proyectos de testing automatizado.`,
    )
    .setVersion('1.0.0')
    .addTag('projects', 'Gestión de proyectos de testing')
    .addTag('endpoints', 'Registro y gestión de endpoints de APIs')
    .addTag('test-execution', 'Ejecución y gestión de resultados de pruebas')
    .addTag('health', 'Estado del servicio')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-API-KEY', in: 'header' }, 'X-API-KEY')
    .addServer('http://localhost:3000', 'Servidor de Desarrollo')
    .addServer('http://localhost:3001', 'Servidor Alternativo 1')
    .addServer('http://localhost:3002', 'Servidor Alternativo 2')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
  // Configurar Swagger con opciones mejoradas
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
    const port = await findAvailablePort();
    await app.listen(port);
    
    logger.log(`🚀 Central Backend MVP corriendo en: http://localhost:${port}`);
    logger.log(`📚 Documentación Swagger en: http://localhost:${port}/docs`);
    logger.log(`🔒 API Version: v1`);
    logger.log(`🏥 Health Check en: http://localhost:${port}/v1/api/health`);
    logger.log(`🔗 Base Path: /v1/api`);
    logger.log(`📊 Endpoints disponibles:`);
    logger.log(`   - Proyectos: http://localhost:${port}/v1/api/projects`);
    logger.log(`   - Endpoints: http://localhost:${port}/v1/api/endpoints`);
    logger.log(`   - Test Execution: http://localhost:${port}/v1/api/projects/:id/test-execution`);
  } catch (error) {
    logger.error('❌ Error al iniciar el servidor:', error.message);
    process.exit(1);
  }
}

bootstrap();
