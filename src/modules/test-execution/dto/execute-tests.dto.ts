import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsBoolean,
  IsNumber,
  IsUUID,
  Min,
  Max,
} from 'class-validator';

/**
 * Specifies the type/category of tests to execute.
 */
export enum TestType {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  ALL = 'all',
}

/**
 * Supported environments for test execution.
 */
export enum TestEnvironment {
  LOCAL = 'local',
  STAGING = 'staging',
  PRODUCTION = 'production',
}

/**
 * DTO: Parameters to execute tests for a project/entity.
 */
export class ExecuteTestsDto {
  @ApiPropertyOptional({
    description: 'Entity name to run tests for. If omitted, all project test cases will run',
    example: 'Product',
  })
  @IsOptional()
  @IsString()
  entityName?: string;

  @ApiPropertyOptional({
    description: 'Specific HTTP method to filter test cases',
    example: 'POST',
  })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({
    description: 'Type of tests to execute',
    enum: TestType,
    default: TestType.ALL,
  })
  @IsOptional()
  @IsEnum(TestType)
  testType?: TestType = TestType.ALL;

  @ApiPropertyOptional({
    description: 'Tags to filter specific test cases',
    example: ['@smoke', '@create'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Specific scenario name to execute',
    example: 'Create Product with valid data',
  })
  @IsOptional()
  @IsString()
  specificScenario?: string;

  @ApiPropertyOptional({
    description: 'Run tests in parallel',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  parallel?: boolean = false;

  @ApiPropertyOptional({
    description: 'Timeout in milliseconds for each test',
    minimum: 1000,
    maximum: 300000,
    default: 30000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(300000)
  timeout?: number = 30000;

  @ApiPropertyOptional({
    description: 'Number of retries on failure',
    minimum: 0,
    maximum: 5,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  retries?: number = 0;

  @ApiPropertyOptional({
    description: 'Target test environment',
    enum: TestEnvironment,
    default: TestEnvironment.LOCAL,
  })
  @IsOptional()
  @IsEnum(TestEnvironment)
  environment?: TestEnvironment = TestEnvironment.LOCAL;

  @ApiPropertyOptional({
    description: 'Show verbose logs',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  verbose?: boolean = false;

  @ApiPropertyOptional({
    description: 'Persist request/response logs',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  saveLogs?: boolean = true;

  @ApiPropertyOptional({
    description: 'Persist request/response payloads',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  savePayloads?: boolean = true;

  @ApiPropertyOptional({
    description: 'Number of workers for parallel execution',
    minimum: 1,
    maximum: 10,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  workers?: number = 1;

  @ApiPropertyOptional({
    description: 'Specific test case ID to execute',
    example: 'TC-ecommerce-Product-2',
  })
  @IsOptional()
  @IsString()
  testCaseId?: string;

  @ApiPropertyOptional({
    description: 'Specific test suite ID to execute',
    example: 'SUITE-ECOMMERCE-PRODUCT-001',
  })
  @IsOptional()
  @IsString()
  testSuiteId?: string;
} 