import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsArray, IsDateString } from 'class-validator';
import { TestType } from './execute-tests.dto';

/**
 * DTO: Filters for listing execution results.
 */
export class ExecutionFiltersDto {
  @ApiPropertyOptional({
    description: 'Filter by entity name',
    example: 'Product',
  })
  @IsOptional()
  @IsString()
  entityName?: string;

  @ApiPropertyOptional({
    description: 'Filter by HTTP method',
    example: 'POST',
  })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({
    description: 'Filter by test type',
    enum: TestType,
  })
  @IsOptional()
  @IsEnum(TestType)
  testType?: TestType;

  @ApiPropertyOptional({
    description: 'Filter by tags',
    example: ['@smoke', '@create'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Filter by execution status',
    example: 'completed',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Start date from (inclusive)',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Start date to (inclusive)',
    example: '2024-01-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Page number',
    default: 1,
  })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Page size (items per page)',
    default: 20,
  })
  @IsOptional()
  limit?: number = 20;
} 