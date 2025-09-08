import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray, IsBoolean, IsNumber } from 'class-validator';
import { TestSuiteType, TestSuiteStatus } from '../entities/test-suite.entity';

/**
 * DTO: Payload to update an existing test suite.
 */
export class UpdateTestSuiteDto {
  @ApiProperty({
    description: 'Name of the test suite',
    example: 'Updated Product API Test Suite',
    required: false
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Description of the test suite',
    example: 'Updated comprehensive test suite for Product API endpoints',
    required: false
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Type of test suite',
    enum: TestSuiteType,
    example: TestSuiteType.TEST_SET,
    required: false
  })
  @IsEnum(TestSuiteType)
  @IsOptional()
  type?: TestSuiteType;

  @ApiProperty({
    description: 'Status of the test suite',
    enum: TestSuiteStatus,
    example: TestSuiteStatus.PENDING,
    required: false
  })
  @IsEnum(TestSuiteStatus)
  @IsOptional()
  status?: TestSuiteStatus;

  @ApiProperty({
    description: 'Array of test case IDs to include',
    example: ['TC-ECOMMERCE-01', 'TC-ECOMMERCE-02'],
    required: false
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  testCaseIds?: string[];

  @ApiProperty({
    description: 'Array of test suite IDs to include (for test plans)',
    example: ['TS-001', 'TS-002'],
    required: false
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  testSuiteIds?: string[];

  @ApiProperty({
    description: 'Execution properties',
    required: false
  })
  @IsOptional()
  executionProperties?: {
    parallel?: boolean;
    timeout?: number;
    retries?: number;
    environment?: string;
    workers?: number;
  };

  @ApiProperty({
    description: 'Array of tags',
    example: ['smoke', 'regression'],
    required: false
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({
    description: 'Metadata for the test suite',
    required: false
  })
  @IsOptional()
  metadata?: {
    createdBy?: string;
    priority?: string;
    estimatedDuration?: number;
    dependencies?: string[];
  };
}
