import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { BugType, BugSeverity, BugPriority, BugStatus } from '../entities/bug.entity';

/**
 * Bug Filters DTO
 * 
 * Defines filtering options for bug queries including search terms,
 * status filters, pagination, and sorting options.
 * 
 * @class BugFiltersDto
 */
export class BugFiltersDto {
  @ApiProperty({
    description: 'Project ID for filtering bugs',
    required: false
  })
  @IsString()
  @IsOptional()
  projectId?: string;

  @ApiProperty({
    description: 'Search term for title or description',
    required: false
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({
    description: 'Filter by bug type',
    enum: BugType,
    required: false
  })
  @IsEnum(BugType)
  @IsOptional()
  type?: BugType;

  @ApiProperty({
    description: 'Filter by severity',
    enum: BugSeverity,
    required: false
  })
  @IsEnum(BugSeverity)
  @IsOptional()
  severity?: BugSeverity;

  @ApiProperty({
    description: 'Filter by priority',
    enum: BugPriority,
    required: false
  })
  @IsEnum(BugPriority)
  @IsOptional()
  priority?: BugPriority;

  @ApiProperty({
    description: 'Filter by status',
    enum: BugStatus,
    required: false
  })
  @IsEnum(BugStatus)
  @IsOptional()
  status?: BugStatus;

  @ApiProperty({
    description: 'Filter by section',
    required: false
  })
  @IsString()
  @IsOptional()
  section?: string;

  @ApiProperty({
    description: 'Filter by entity',
    required: false
  })
  @IsString()
  @IsOptional()
  entity?: string;

  @ApiProperty({
    description: 'Filter by test case ID',
    required: false
  })
  @IsString()
  @IsOptional()
  testCaseId?: string;

  @ApiProperty({
    description: 'Filter by test suite ID',
    required: false
  })
  @IsString()
  @IsOptional()
  testSuiteId?: string;

  @ApiProperty({
    description: 'Filter by execution ID',
    required: false
  })
  @IsString()
  @IsOptional()
  executionId?: string;

  @ApiProperty({
    description: 'Filter by environment',
    required: false
  })
  @IsString()
  @IsOptional()
  environment?: string;

  @ApiProperty({
    description: 'Sort by field',
    example: 'reportedAt',
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

  @ApiProperty({
    description: 'Page number',
    example: 1,
    required: false
  })
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiProperty({
    description: 'Items per page',
    example: 10,
    required: false
  })
  @IsNumber()
  @IsOptional()
  limit?: number;
}
