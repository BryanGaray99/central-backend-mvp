import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TestSummary, ExecutionMetadata } from '../interfaces/execution-metadata.interface';

export class TestResultsDto {
  @ApiProperty({
    description: 'ID único de la ejecución',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  executionId: string;

  @ApiProperty({
    description: 'Estado de la ejecución',
    example: 'completed',
  })
  status: string;

  @ApiProperty({
    description: 'Resumen de la ejecución',
  })
  summary: TestSummary;

  @ApiProperty({
    description: 'Resultados detallados de cada escenario',
    type: 'array',
  })
  results: any[];

  @ApiPropertyOptional({
    description: 'Metadatos de la ejecución',
  })
  metadata?: ExecutionMetadata;

  @ApiProperty({
    description: 'Fecha de inicio de la ejecución',
  })
  startedAt: Date;

  @ApiPropertyOptional({
    description: 'Fecha de finalización de la ejecución',
  })
  completedAt?: Date;

  @ApiProperty({
    description: 'Tiempo total de ejecución en milisegundos',
  })
  executionTime: number;

  @ApiPropertyOptional({
    description: 'Mensaje de error si la ejecución falló',
  })
  errorMessage?: string;
} 