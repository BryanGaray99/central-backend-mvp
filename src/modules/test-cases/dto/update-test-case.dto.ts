import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  IsEnum,
  IsOptional,
  ValidateNested,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TestType, Priority, Complexity } from '../entities/test-case.entity';
import { StepDefinitionDto, ScenarioStructureDto, HooksDto, TestCaseMetadataDto } from './create-test-case.dto';

export class UpdateTestCaseDto {
  @ApiPropertyOptional({
    description: 'Nuevo nombre del caso de prueba',
    example: 'Create Product with valid data - Enhanced',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Nueva descripción del caso de prueba',
    example: 'Verificar que se puede crear un producto con datos válidos - Versión mejorada',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Nueva entidad asociada',
    example: 'Product',
  })
  @IsOptional()
  @IsString()
  entityName?: string;

  @ApiPropertyOptional({
    description: 'Nueva sección del proyecto',
    example: 'ecommerce',
  })
  @IsOptional()
  @IsString()
  section?: string;

  @ApiPropertyOptional({
    description: 'Nuevo método HTTP',
    example: 'POST',
  })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({
    description: 'Nuevo tipo de prueba',
    enum: TestType,
  })
  @IsOptional()
  @IsEnum(TestType)
  testType?: TestType;

  @ApiPropertyOptional({
    description: 'Nuevos tags del caso de prueba',
    example: ['@smoke', '@create', '@enhanced'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Nueva estructura del escenario',
    type: ScenarioStructureDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ScenarioStructureDto)
  scenario?: ScenarioStructureDto;

  @ApiPropertyOptional({
    description: 'Nuevos hooks específicos para este test case',
    type: HooksDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => HooksDto)
  hooks?: HooksDto;

  @ApiPropertyOptional({
    description: 'Nuevos ejemplos para Scenario Outline',
    type: 'array',
  })
  @IsOptional()
  examples?: Array<Record<string, any>>;

  @ApiPropertyOptional({
    description: 'Nuevos metadatos adicionales',
    type: TestCaseMetadataDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TestCaseMetadataDto)
  metadata?: TestCaseMetadataDto;
} 