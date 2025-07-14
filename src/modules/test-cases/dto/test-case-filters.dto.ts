import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { TestType, Priority, Complexity } from '../entities/test-case.entity';

export class TestCaseFiltersDto {
  @ApiPropertyOptional({
    description: 'Filtrar por nombre de entidad',
    example: 'Product',
  })
  @IsOptional()
  @IsString()
  entityName?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por sección',
    example: 'ecommerce',
  })
  @IsOptional()
  @IsString()
  section?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por método HTTP',
    example: 'POST',
  })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo de prueba',
    enum: TestType,
  })
  @IsOptional()
  @IsEnum(TestType)
  testType?: TestType;

  @ApiPropertyOptional({
    description: 'Filtrar por tags',
    example: ['@smoke', '@create'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Filtrar por prioridad',
    enum: Priority,
  })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({
    description: 'Filtrar por complejidad',
    enum: Complexity,
  })
  @IsOptional()
  @IsEnum(Complexity)
  complexity?: Complexity;

  @ApiPropertyOptional({
    description: 'Filtrar por estado',
    example: 'active',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Buscar por nombre o descripción',
    example: 'create product',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Fecha de creación desde',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  createdAtFrom?: string;

  @ApiPropertyOptional({
    description: 'Fecha de creación hasta',
    example: '2024-01-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  createdAtTo?: string;

  @ApiPropertyOptional({
    description: 'Fecha de actualización desde',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  updatedAtFrom?: string;

  @ApiPropertyOptional({
    description: 'Fecha de actualización hasta',
    example: '2024-01-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  updatedAtTo?: string;

  @ApiPropertyOptional({
    description: 'Número de página',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Límite de resultados por página',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Campo para ordenar',
    example: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Dirección del ordenamiento',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
} 