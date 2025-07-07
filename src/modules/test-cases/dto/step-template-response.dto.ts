import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StepType, StepTemplateType, Reusability, StepStatus } from '../entities/test-step.entity';

export class StepParameterResponseDto {
  @ApiProperty({
    description: 'Nombre del parámetro',
    example: 'entityName',
  })
  name: string;

  @ApiProperty({
    description: 'Tipo del parámetro',
    enum: ['string', 'number', 'boolean', 'object'],
  })
  type: 'string' | 'number' | 'boolean' | 'object';

  @ApiProperty({
    description: 'Si el parámetro es requerido',
    default: true,
  })
  required: boolean;

  @ApiPropertyOptional({
    description: 'Valor por defecto del parámetro',
  })
  defaultValue?: any;

  @ApiPropertyOptional({
    description: 'Reglas condicionales del parámetro',
    type: 'object',
    additionalProperties: true,
  })
  conditional?: any;

  @ApiPropertyOptional({
    description: 'Configuración dinámica del parámetro',
    type: 'object',
    additionalProperties: true,
  })
  dynamic?: any;
}

export class StepValidationResponseDto {
  @ApiProperty({
    description: 'Código de prueba para validación',
    example: 'const step = new Step("ST-ECOMMERCE-CREATE-01"); expect(step.isValid()).toBe(true);',
  })
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
  timeout: number;
}

export class StepValidationConfigResponseDto {
  @ApiPropertyOptional({
    description: 'Validación de sintaxis',
    type: StepValidationResponseDto,
  })
  syntax?: StepValidationResponseDto;

  @ApiPropertyOptional({
    description: 'Validación de runtime',
    type: StepValidationResponseDto,
  })
  runtime?: StepValidationResponseDto;

  @ApiPropertyOptional({
    description: 'Validación de integración',
    type: StepValidationResponseDto,
  })
  integration?: StepValidationResponseDto;
}

export class StepMetadataResponseDto {
  @ApiPropertyOptional({
    description: 'Categoría del step',
    example: 'validation',
  })
  category?: string;

  @ApiPropertyOptional({
    description: 'Complejidad del step',
    enum: ['simple', 'medium', 'complex'],
  })
  complexity?: 'simple' | 'medium' | 'complex';

  @ApiPropertyOptional({
    description: 'Nivel de reutilización del step',
    enum: Reusability,
  })
  reusability?: Reusability;
}

export class TestStepResponseDto {
  @ApiProperty({
    description: 'ID único del step',
    example: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'ID del step template',
    example: 'ST-ECOMMERCE-CREATE-01',
  })
  stepId: string;

  @ApiProperty({
    description: 'ID del proyecto',
    example: 'uuid',
  })
  projectId: string;

  @ApiProperty({
    description: 'Nombre del step',
    example: 'I create a {entityName}',
  })
  name: string;

  @ApiProperty({
    description: 'Definición del step en lenguaje natural',
    example: 'I create a {entityName}',
  })
  definition: string;

  @ApiProperty({
    description: 'Tipo de step',
    enum: StepType,
  })
  type: StepType;

  @ApiProperty({
    description: 'Tipo de template del step',
    enum: StepTemplateType,
  })
  stepType: StepTemplateType;

  @ApiProperty({
    description: 'Parámetros del step',
    type: [StepParameterResponseDto],
  })
  parameters: StepParameterResponseDto[];

  @ApiProperty({
    description: 'Implementación del step en código',
    example: 'async function(entityName) { const client = this.getClient(entityName); const data = this[`${entityName.toLowerCase()}Data`]; const response = await client.create(data); this.lastResponse = response; }',
  })
  implementation: string;

  @ApiPropertyOptional({
    description: 'Configuración de validaciones',
    type: StepValidationConfigResponseDto,
  })
  validation?: StepValidationConfigResponseDto;

  @ApiProperty({
    description: 'Estado del step',
    enum: StepStatus,
  })
  status: StepStatus;

  @ApiPropertyOptional({
    description: 'Metadatos del step',
    type: StepMetadataResponseDto,
  })
  metadata?: StepMetadataResponseDto;

  @ApiProperty({
    description: 'Fecha de creación',
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha de actualización',
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;
} 