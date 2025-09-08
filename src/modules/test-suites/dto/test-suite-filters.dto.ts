import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsNumber, IsArray } from 'class-validator';
import { TestSuiteType, TestSuiteStatus } from '../entities/test-suite.entity';

/**
 * DTO: Query filters for listing test suites.
 */
export class TestSuiteFiltersDto {
  @ApiProperty({
    description: 'Filter by test suite type',
    enum: TestSuiteType,
    required: false
  })
  @IsEnum(TestSuiteType)
  @IsOptional()
  type?: TestSuiteType;

  @ApiProperty({
    description: 'Filter by test suite status',
    enum: TestSuiteStatus,
    required: false
  })
  @IsEnum(TestSuiteStatus)
  @IsOptional()
  status?: TestSuiteStatus;

  @ApiProperty({
    description: 'Filter by section',
    example: 'ecommerce',
    required: false
  })
  @IsString()
  @IsOptional()
  section?: string;

  @ApiProperty({
    description: 'Filter by entity',
    example: 'Product',
    required: false
  })
  @IsString()
  @IsOptional()
  entity?: string;

  @ApiProperty({
    description: 'Filter by tags',
    example: ['smoke', 'regression'],
    required: false
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({
    description: 'Filter by environment',
    example: 'staging',
    required: false
  })
  @IsString()
  @IsOptional()
  environment?: string;

  @ApiProperty({
    description: 'Search by name or description',
    example: 'Product API',
    required: false
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    required: false
  })
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
    required: false
  })
  @IsNumber()
  @IsOptional()
  limit?: number;

  @ApiProperty({
    description: 'Sort by field',
    example: 'createdAt',
    required: false
  })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiProperty({
    description: 'Sort order',
    example: 'DESC',
    required: false
  })
  @IsString()
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC';
}
