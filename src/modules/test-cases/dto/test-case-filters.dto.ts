import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { TestType, Priority, Complexity } from '../entities/test-case.entity';

/**
 * Data Transfer Object for test case filtering options.
 *
 * This DTO defines the structure and validation rules for filtering test cases.
 * It includes various filter criteria, pagination, and sorting options.
 *
 * @class TestCaseFiltersDto
 * @since 1.0.0
 */
export class TestCaseFiltersDto {
  /**
   * Filter by entity name.
   *
   * @example 'Product'
   */
  @ApiPropertyOptional({
    description: 'Filter by entity name',
    example: 'Product',
  })
  @IsOptional()
  @IsString()
  entityName?: string;

  /**
   * Filter by section.
   *
   * @example 'ecommerce'
   */
  @ApiPropertyOptional({
    description: 'Filter by section',
    example: 'ecommerce',
  })
  @IsOptional()
  @IsString()
  section?: string;

  /**
   * Filter by HTTP method.
   *
   * @example 'POST'
   */
  @ApiPropertyOptional({
    description: 'Filter by HTTP method',
    example: 'POST',
  })
  @IsOptional()
  @IsString()
  method?: string;

  /**
   * Filter by test type.
   */
  @ApiPropertyOptional({
    description: 'Filter by test type',
    enum: TestType,
  })
  @IsOptional()
  @IsEnum(TestType)
  testType?: TestType;

  /**
   * Filter by tags.
   *
   * @example ['@smoke', '@create']
   */
  @ApiPropertyOptional({
    description: 'Filter by tags',
    example: ['@smoke', '@create'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  /**
   * Filter by priority.
   */
  @ApiPropertyOptional({
    description: 'Filter by priority',
    enum: Priority,
  })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  /**
   * Filter by complexity.
   */
  @ApiPropertyOptional({
    description: 'Filter by complexity',
    enum: Complexity,
  })
  @IsOptional()
  @IsEnum(Complexity)
  complexity?: Complexity;

  /**
   * Filter by status.
   *
   * @example 'active'
   */
  @ApiPropertyOptional({
    description: 'Filter by status',
    example: 'active',
  })
  @IsOptional()
  @IsString()
  status?: string;

  /**
   * Search by name or description.
   *
   * @example 'create product'
   */
  @ApiPropertyOptional({
    description: 'Search by name or description',
    example: 'create product',
  })
  @IsOptional()
  @IsString()
  search?: string;

  /**
   * Filter by creation date from.
   *
   * @example '2024-01-01T00:00:00Z'
   */
  @ApiPropertyOptional({
    description: 'Filter by creation date from',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  createdAtFrom?: string;

  /**
   * Filter by creation date to.
   *
   * @example '2024-01-31T23:59:59Z'
   */
  @ApiPropertyOptional({
    description: 'Filter by creation date to',
    example: '2024-01-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  createdAtTo?: string;

  /**
   * Filter by update date from.
   *
   * @example '2024-01-01T00:00:00Z'
   */
  @ApiPropertyOptional({
    description: 'Filter by update date from',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  updatedAtFrom?: string;

  /**
   * Filter by update date to.
   *
   * @example '2024-01-31T23:59:59Z'
   */
  @ApiPropertyOptional({
    description: 'Filter by update date to',
    example: '2024-01-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  updatedAtTo?: string;

  /**
   * Page number for pagination.
   *
   * @default 1
   */
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  /**
   * Limit of results per page.
   *
   * @default 20
   */
  @ApiPropertyOptional({
    description: 'Limit of results per page',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  /**
   * Field to sort by.
   *
   * @default 'createdAt'
   * @example 'createdAt'
   */
  @ApiPropertyOptional({
    description: 'Field to sort by',
    example: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  /**
   * Sort order direction.
   *
   * @default 'DESC'
   */
  @ApiPropertyOptional({
    description: 'Sort order direction',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
} 