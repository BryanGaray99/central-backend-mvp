// NOTA: Si aparecen errores de tipos relacionados con Swagger o NestJS en Windows, puede deberse a múltiples node_modules en rutas diferentes. Reiniciar el IDE o limpiar node_modules puede ayudar.
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import * as dotenv from 'dotenv';
import * as net from 'net';

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
  
  throw new Error('No se encontró un puerto disponible. Puertos 3000, 3001 y 3002 están ocupados.');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validación global de DTOs
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Filtros e interceptores globales
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('Central Backend MVP')
    .setDescription('API central para generación y orquestación de proyectos de testing')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  try {
    const port = await findAvailablePort();
    await app.listen(port);
    console.log(`🚀 Central Backend corriendo en http://localhost:${port}`);
    console.log(`📚 Documentación Swagger en http://localhost:${port}/api`);
    console.log(`🏥 Health Check en http://localhost:${port}/health`);
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error.message);
    process.exit(1);
  }
}

bootstrap();
