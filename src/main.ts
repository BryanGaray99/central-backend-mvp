// NOTA: Si aparecen errores de tipos relacionados con Swagger o NestJS en Windows, puede deberse a múltiples node_modules en rutas diferentes. Reiniciar el IDE o limpiar node_modules puede ayudar.
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import * as dotenv from 'dotenv';

dotenv.config();

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

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  console.log(`🚀 Central Backend corriendo en http://localhost:${port}`);
  console.log(`📚 Documentación Swagger en http://localhost:${port}/api`);
}
bootstrap();
