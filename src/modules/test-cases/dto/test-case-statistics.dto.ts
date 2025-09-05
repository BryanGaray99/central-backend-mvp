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
