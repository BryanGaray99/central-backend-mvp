import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { StepType, StepStatus } from '../entities/test-step.entity';

/**
 * Data Transfer Object for test step filtering options.
 *
 * This DTO defines the structure and validation rules for filtering test steps.
 * It includes various filter criteria, pagination, and sorting options.
 *
 * @class TestStepFiltersDto
 * @since 1.0.0
 */
export class TestStepFiltersDto {
  /**
   * Filter by section.
   *
   * @example 'ecommerce'
   */
  @ApiPropertyOptional({ description: 'Filter by section' })
  @IsOptional()
  @IsString()
  section?: string;

  /**
   * Filter by entity name.
   *
   * @example 'Product'
   */
  @ApiPropertyOptional({ description: 'Filter by entity name' })
  @IsOptional()
  @IsString()
  entityName?: string;

  /**
   * Filter by step type.
   */
  @ApiPropertyOptional({ description: 'Filter by step type', enum: StepType })
  @IsOptional()
  @IsEnum(StepType)
  type?: StepType;

  /**
   * Filter by status.
   */
  @ApiPropertyOptional({ description: 'Filter by status', enum: StepStatus })
  @IsOptional()
  @IsEnum(StepStatus)
  status?: StepStatus;

  /**
   * Search in step name and definition.
   *
   * @example 'create product'
   */
  @ApiPropertyOptional({ description: 'Search in step name and definition' })
  @IsOptional()
  @IsString()
  search?: string;

  /**
   * Page number for pagination.
   *
   * @default 1
   */
  @ApiPropertyOptional({ description: 'Page number', minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  page?: number = 1;

  /**
   * Items per page.
   *
   * @default 20
   */
  @ApiPropertyOptional({ description: 'Items per page', minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  /**
   * Field to sort by.
   *
   * @default 'createdAt'
   */
  @ApiPropertyOptional({ description: 'Sort by field' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  /**
   * Sort order direction.
   *
   * @default 'DESC'
   */
  @ApiPropertyOptional({ description: 'Sort order', enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
} 