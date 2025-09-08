import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray } from 'class-validator';
import { TestSuiteType } from '../entities/test-suite.entity';

/**
 * DTO: Payload to create a new test suite (test set or test plan).
 */
export class CreateTestSuiteDto {
  @ApiProperty({
    description: 'Name of the test suite',
    example: 'Product API Test Suite'
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Description of the test suite',
    example: 'Comprehensive test suite for Product API endpoints',
    required: false
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Type of test suite',
    enum: TestSuiteType,
    example: TestSuiteType.TEST_SET
  })
  @IsEnum(TestSuiteType)
  type: TestSuiteType;

  @ApiProperty({
    description: 'Section of the API',
    example: 'ecommerce',
    required: false
  })
  @IsString()
  @IsOptional()
  section?: string;

  @ApiProperty({
    description: 'Entity name',
    example: 'Product',
    required: false
  })
  @IsString()
  @IsOptional()
  entity?: string;

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
    description: 'Array of tags',
    example: ['smoke', 'regression'],
    required: false
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
