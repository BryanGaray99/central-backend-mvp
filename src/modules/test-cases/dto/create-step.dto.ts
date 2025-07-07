import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  IsEnum,
  IsOptional,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StepType, StepTemplateType, Reusability } from '../entities/test-step.entity';

export class StepParameterDto {
  @ApiProperty({
    description: 'Nombre del parámetro',
    example: 'entityName',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Tipo del parámetro',
    enum: ['string', 'number', 'boolean', 'object'],
  })
  @IsString()
  type: 'string' | 'number' | 'boolean' | 'object';

  @ApiProperty({
    description: 'Si el parámetro es requerido',
    default: true,
  })
  @IsBoolean()
  required: boolean = true;

  @ApiPropertyOptional({
    description: 'Valor por defecto del parámetro',
  })
  @IsOptional()
  defaultValue?: any;

  @ApiPropertyOptional({
    description: 'Reglas condicionales del parámetro',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  conditional?: any;

  @ApiPropertyOptional({
    description: 'Configuración dinámica del parámetro',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  dynamic?: any;
}

export class StepValidationDto {
  @ApiProperty({
    description: 'Código de prueba para validación',
    example: 'const step = new Step("ST-ECOMMERCE-CREATE-01"); expect(step.isValid()).toBe(true);',
  })
  @IsString()
  testCode: string;

  @ApiProperty({
    description: 'Resultado esperado de la validación',
  })
  expectedResult: any;

  @ApiProperty({
    description: 'Timeout en milisegundos',
    minimum: 100,
    maximum: 30000,
  })
  @IsString()
  timeout: number;
}

export class StepValidationConfigDto {
  @ApiPropertyOptional({
    description: 'Validación de sintaxis',
    type: StepValidationDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StepValidationDto)
  syntax?: StepValidationDto;

  @ApiPropertyOptional({
    description: 'Validación de runtime',
    type: StepValidationDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StepValidationDto)
  runtime?: StepValidationDto;

  @ApiPropertyOptional({
    description: 'Validación de integración',
    type: StepValidationDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StepValidationDto)
  integration?: StepValidationDto;
}

export class StepMetadataDto {
  @ApiPropertyOptional({
    description: 'Categoría del step',
    example: 'validation',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Complejidad del step',
    enum: ['simple', 'medium', 'complex'],
  })
  @IsOptional()
  @IsString()
  complexity?: 'simple' | 'medium' | 'complex';

  @ApiPropertyOptional({
    description: 'Nivel de reutilización del step',
    enum: Reusability,
  })
  @IsOptional()
  @IsEnum(Reusability)
  reusability?: Reusability;
}

export class CreateStepDto {
  @ApiProperty({
    description: 'Nombre del step',
    example: 'I create a {entityName}',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Definición del step en lenguaje natural',
    example: 'I create a {entityName}',
  })
  @IsString()
  definition: string;

  @ApiProperty({
    description: 'Tipo de step',
    enum: StepType,
  })
  @IsEnum(StepType)
  type: StepType;

  @ApiProperty({
    description: 'Tipo de template del step',
    enum: StepTemplateType,
    default: StepTemplateType.PREDEFINED,
  })
  @IsEnum(StepTemplateType)
  stepType: StepTemplateType = StepTemplateType.PREDEFINED;

  @ApiProperty({
    description: 'Parámetros del step',
    type: [StepParameterDto],
  })
  @ValidateNested({ each: true })
  @Type(() => StepParameterDto)
  parameters: StepParameterDto[];

  @ApiProperty({
    description: 'Implementación del step en código',
    example: 'async function(entityName) { const client = this.getClient(entityName); const data = this[`${entityName.toLowerCase()}Data`]; const response = await client.create(data); this.lastResponse = response; }',
  })
  @IsString()
  implementation: string;

  @ApiPropertyOptional({
    description: 'Configuración de validaciones',
    type: StepValidationConfigDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StepValidationConfigDto)
  validation?: StepValidationConfigDto;

  @ApiPropertyOptional({
    description: 'Metadatos del step',
    type: StepMetadataDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StepMetadataDto)
  metadata?: StepMetadataDto;
} 