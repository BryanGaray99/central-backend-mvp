import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class StepDefinitionDto {
  @ApiProperty({
    description: 'ID del step template',
    example: 'ST-ECOMMERCE-CREATE-01',
  })
  @IsString()
  stepId: string;

  @ApiPropertyOptional({
    description: 'Parámetros específicos para este step',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  parameters?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Orden del step en el escenario',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  order?: number = 0;
}

export class ScenarioStructureDto {
  @ApiProperty({
    description: 'Steps Given del escenario',
    type: [StepDefinitionDto],
  })
  @ValidateNested({ each: true })
  @Type(() => StepDefinitionDto)
  given: StepDefinitionDto[];

  @ApiProperty({
    description: 'Steps When del escenario',
    type: [StepDefinitionDto],
  })
  @ValidateNested({ each: true })
  @Type(() => StepDefinitionDto)
  when: StepDefinitionDto[];

  @ApiProperty({
    description: 'Steps Then del escenario',
    type: [StepDefinitionDto],
  })
  @ValidateNested({ each: true })
  @Type(() => StepDefinitionDto)
  then: StepDefinitionDto[];
}

export class HooksDto {
  @ApiPropertyOptional({
    description: 'Steps a ejecutar antes del escenario',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  before?: string[];

  @ApiPropertyOptional({
    description: 'Steps a ejecutar después del escenario',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  after?: string[];

  @ApiPropertyOptional({
    description: 'Si se deben saltar los hooks automáticos',
    default: false,
  })
  @IsOptional()
  skipDefault?: boolean;
}

export class TestCaseMetadataDto {
  @ApiPropertyOptional({
    description: 'Prioridad del test case',
    enum: Priority,
  })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({
    description: 'Complejidad del test case',
    enum: Complexity,
  })
  @IsOptional()
  @IsEnum(Complexity)
  complexity?: Complexity;

  @ApiPropertyOptional({
    description: 'Duración estimada en milisegundos',
    minimum: 100,
    maximum: 300000,
  })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(300000)
  estimatedDuration?: number;

  @ApiPropertyOptional({
    description: 'Dependencias del test case',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dependencies?: string[];
}

export class CreateTestCaseDto {
  @ApiProperty({
    description: 'Nombre del caso de prueba',
    example: 'Create Product with valid data',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Descripción del caso de prueba',
    example: 'Verificar que se puede crear un producto con datos válidos',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Entidad asociada',
    example: 'Product',
  })
  @IsString()
  entityName: string;

  @ApiProperty({
    description: 'Sección del proyecto',
    example: 'ecommerce',
  })
  @IsString()
  section: string;

  @ApiProperty({
    description: 'Método HTTP',
    example: 'POST',
  })
  @IsString()
  method: string;

  @ApiProperty({
    description: 'Tipo de prueba',
    enum: TestType,
    default: TestType.POSITIVE,
  })
  @IsEnum(TestType)
  testType: TestType = TestType.POSITIVE;

  @ApiProperty({
    description: 'Tags del caso de prueba',
    example: ['@smoke', '@create'],
  })
  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @ApiProperty({
    description: 'Contenido del escenario como texto Gherkin',
    example: 'Given I have valid Product data\nWhen I create a Product\nThen the Product should be created successfully',
  })
  @IsString()
  scenario: string;

  @ApiPropertyOptional({
    description: 'Hooks específicos para este test case',
    type: HooksDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => HooksDto)
  hooks?: HooksDto;

  @ApiPropertyOptional({
    description: 'Ejemplos para Scenario Outline',
    type: 'array',
  })
  @IsOptional()
  examples?: Array<Record<string, any>>;

  @ApiPropertyOptional({
    description: 'Metadatos adicionales',
    type: TestCaseMetadataDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TestCaseMetadataDto)
  metadata?: TestCaseMetadataDto;
} 