import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TestType, Priority, Complexity, TestCaseStatus } from '../entities/test-case.entity';

export class StepDefinitionResponseDto {
  @ApiProperty({
    description: 'ID del step template',
    example: 'ST-ECOMMERCE-CREATE-01',
  })
  stepId: string;

  @ApiPropertyOptional({
    description: 'Parámetros específicos para este step',
    type: 'object',
    additionalProperties: true,
  })
  parameters?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Orden del step en el escenario',
    default: 0,
  })
  order?: number;
}

export class ScenarioStructureResponseDto {
  @ApiProperty({
    description: 'Steps Given del escenario',
    type: [StepDefinitionResponseDto],
  })
  given: StepDefinitionResponseDto[];

  @ApiProperty({
    description: 'Steps When del escenario',
    type: [StepDefinitionResponseDto],
  })
  when: StepDefinitionResponseDto[];

  @ApiProperty({
    description: 'Steps Then del escenario',
    type: [StepDefinitionResponseDto],
  })
  then: StepDefinitionResponseDto[];
}

export class TestCaseHooksResponseDto {
  @ApiPropertyOptional({
    description: 'Steps a ejecutar antes del escenario',
    type: [String],
  })
  before?: string[];

  @ApiPropertyOptional({
    description: 'Steps a ejecutar después del escenario',
    type: [String],
  })
  after?: string[];

  @ApiPropertyOptional({
    description: 'Si se deben saltar los hooks automáticos',
    default: false,
  })
  skipDefault?: boolean;
}

export class TestCaseMetadataResponseDto {
  @ApiPropertyOptional({
    description: 'Prioridad del test case',
    enum: Priority,
  })
  priority?: Priority;

  @ApiPropertyOptional({
    description: 'Complejidad del test case',
    enum: Complexity,
  })
  complexity?: Complexity;

  @ApiPropertyOptional({
    description: 'Duración estimada en milisegundos',
    minimum: 100,
    maximum: 300000,
  })
  estimatedDuration?: number;

  @ApiPropertyOptional({
    description: 'Dependencias del test case',
    type: [String],
  })
  dependencies?: string[];
}

export class TestCaseResponseDto {
  @ApiProperty({
    description: 'ID único del test case',
    example: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'ID del test case',
    example: 'TC-ECOMMERCE-01',
  })
  testCaseId: string;

  @ApiProperty({
    description: 'ID del proyecto',
    example: 'uuid',
  })
  projectId: string;

  @ApiProperty({
    description: 'Nombre de la entidad',
    example: 'Product',
  })
  entityName: string;

  @ApiProperty({
    description: 'Sección del proyecto',
    example: 'ecommerce',
  })
  section: string;

  @ApiProperty({
    description: 'Nombre del caso de prueba',
    example: 'Create Product with valid data',
  })
  name: string;

  @ApiProperty({
    description: 'Descripción del caso de prueba',
    example: 'Verificar que se puede crear un producto con datos válidos',
  })
  description: string;

  @ApiProperty({
    description: 'Tags del caso de prueba',
    example: ['@smoke', '@create'],
  })
  tags: string[];

  @ApiProperty({
    description: 'Método HTTP',
    example: 'POST',
  })
  method: string;

  @ApiProperty({
    description: 'Tipo de prueba',
    enum: TestType,
  })
  testType: TestType;

  @ApiProperty({
    description: 'Contenido del escenario como texto Gherkin',
    example: 'Given I have valid Product data\nWhen I create a Product\nThen the Product should be created successfully',
  })
  scenario: string;

  @ApiPropertyOptional({
    description: 'Hooks específicos para este test case',
    type: TestCaseHooksResponseDto,
  })
  hooks?: TestCaseHooksResponseDto;

  @ApiPropertyOptional({
    description: 'Ejemplos para Scenario Outline',
    type: 'array',
  })
  examples?: Array<Record<string, any>>;

  @ApiProperty({
    description: 'Estado del test case',
    enum: TestCaseStatus,
  })
  status: TestCaseStatus;

  @ApiPropertyOptional({
    description: 'Metadatos adicionales',
    type: TestCaseMetadataResponseDto,
  })
  metadata?: TestCaseMetadataResponseDto;

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