import { ApiProperty } from '@nestjs/swagger';

export class PaginationDto {
  @ApiProperty({
    description: 'Número de página actual',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Límite de resultados por página',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: 'Total de resultados',
    example: 100,
  })
  total: number;

  @ApiProperty({
    description: 'Total de páginas',
    example: 5,
  })
  totalPages: number;
}

export class TestCaseListResponseDto {
  @ApiProperty({
    description: 'Lista de test cases',
    type: 'array',
    items: { $ref: '#/components/schemas/TestCaseResponseDto' },
  })
  testCases: any[];

  @ApiProperty({
    description: 'Información de paginación',
    type: PaginationDto,
  })
  pagination: PaginationDto;

  @ApiProperty({
    description: 'Filtros aplicados',
    type: 'object',
    additionalProperties: true,
  })
  filters: any;
}

export class TestCaseStatisticsDto {
  @ApiProperty({
    description: 'Total de casos de prueba',
    example: 100,
  })
  totalCases: number;

  @ApiProperty({
    description: 'Casos de prueba positivos',
    example: 60,
  })
  positiveCases: number;

  @ApiProperty({
    description: 'Casos de prueba negativos',
    example: 30,
  })
  negativeCases: number;

  @ApiProperty({
    description: 'Casos de prueba edge case',
    example: 10,
  })
  edgeCases: number;

  @ApiProperty({
    description: 'Casos de prueba activos',
    example: 80,
  })
  activeCases: number;

  @ApiProperty({
    description: 'Casos de prueba en borrador',
    example: 15,
  })
  draftCases: number;

  @ApiProperty({
    description: 'Casos de prueba deprecados',
    example: 5,
  })
  deprecatedCases: number;

  @ApiProperty({
    description: 'Duración promedio en milisegundos',
    example: 1500,
  })
  averageDuration: number;

  @ApiProperty({
    description: 'Última actualización',
    example: '2024-01-01T00:00:00Z',
  })
  lastUpdated: Date;
}

export class StepTemplateStatisticsDto {
  @ApiProperty({
    description: 'Total de step templates',
    example: 50,
  })
  totalSteps: number;

  @ApiProperty({
    description: 'Step templates activos',
    example: 45,
  })
  activeSteps: number;

  @ApiProperty({
    description: 'Step templates deprecados',
    example: 5,
  })
  deprecatedSteps: number;

  @ApiProperty({
    description: 'Steps más utilizados',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        stepId: { type: 'string', example: 'ST-ECOMMERCE-CREATE-01' },
        name: { type: 'string', example: 'I create a {entityName}' },
        usageCount: { type: 'number', example: 25 },
      },
    },
  })
  mostUsedSteps: Array<{
    stepId: string;
    name: string;
    usageCount: number;
  }>;

  @ApiProperty({
    description: 'Última actualización',
    example: '2024-01-01T00:00:00Z',
  })
  lastUpdated: Date;
}

export class TestCaseExportDto {
  @ApiProperty({
    description: 'ID del test case',
    example: 'TC-ECOMMERCE-01',
  })
  testCaseId: string;

  @ApiProperty({
    description: 'Nombre del test case',
    example: 'Create Product with valid data',
  })
  name: string;

  @ApiProperty({
    description: 'Descripción del test case',
    example: 'Verificar que se puede crear un producto con datos válidos',
  })
  description: string;

  @ApiProperty({
    description: 'Tags del test case',
    example: ['@smoke', '@create'],
  })
  tags: string[];

  @ApiProperty({
    description: 'Código Gherkin generado',
    example: '@smoke @create\nScenario: Create Product with valid data\n  Given I have a valid product data\n  When I create a product\n  Then the product should be created successfully',
  })
  gherkin: string;

  @ApiProperty({
    description: 'Metadatos del test case',
    type: 'object',
    properties: {
      entityName: { type: 'string', example: 'Product' },
      method: { type: 'string', example: 'POST' },
      testType: { type: 'string', example: 'positive' },
      priority: { type: 'string', example: 'high' },
      complexity: { type: 'string', example: 'medium' },
    },
  })
  metadata: {
    entityName: string;
    method: string;
    testType: string;
    priority?: string;
    complexity?: string;
  };
} 