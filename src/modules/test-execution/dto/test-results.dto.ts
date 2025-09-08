import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TestSummary, ExecutionMetadata } from '../interfaces/execution-metadata.interface';

/**
 * DTO: Detailed execution results returned by the API.
 */
export class TestResultsDto {
  @ApiProperty({
    description: 'Unique execution ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  executionId: string;

  @ApiProperty({
    description: 'Execution status',
    example: 'completed',
  })
  status: string;

  @ApiProperty({
    description: 'Execution summary',
  })
  summary: TestSummary;

  @ApiProperty({
    description: 'Detailed results for each scenario',
    type: 'array',
  })
  results: any[];

  @ApiPropertyOptional({
    description: 'Execution metadata',
  })
  metadata?: ExecutionMetadata;

  @ApiProperty({
    description: 'Execution start date-time',
  })
  startedAt: Date;

  @ApiPropertyOptional({
    description: 'Execution completion date-time',
  })
  completedAt?: Date;

  @ApiProperty({
    description: 'Total execution time in milliseconds',
  })
  executionTime: number;

  @ApiPropertyOptional({
    description: 'Error message if the execution failed',
  })
  errorMessage?: string;
} 