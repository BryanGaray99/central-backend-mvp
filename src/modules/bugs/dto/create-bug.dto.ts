import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { BugType, BugSeverity, BugPriority } from '../entities/bug.entity';

/**
 * Create Bug DTO
 * 
 * Defines the structure for creating new bugs including required
 * fields like title, description, type, and severity, along with
 * optional fields for test case context and error details.
 * 
 * @class CreateBugDto
 */
export class CreateBugDto {
  @ApiProperty({
    description: 'Title of the bug',
    example: 'Product creation fails with 500 error'
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Detailed description of the bug',
    example: 'When creating a product with valid data, the API returns a 500 internal server error instead of 201 Created.'
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Type of bug',
    enum: BugType,
    example: BugType.TEST_FAILURE
  })
  @IsEnum(BugType)
  type: BugType;

  @ApiProperty({
    description: 'Severity of the bug',
    enum: BugSeverity,
    example: BugSeverity.HIGH
  })
  @IsEnum(BugSeverity)
  severity: BugSeverity;

  @ApiProperty({
    description: 'Priority of the bug',
    enum: BugPriority,
    example: BugPriority.HIGH,
    required: false
  })
  @IsEnum(BugPriority)
  @IsOptional()
  priority?: BugPriority;

  @ApiProperty({
    description: 'Test case ID where the bug occurred',
    example: 'TC-ECOMMERCE-01',
    required: false
  })
  @IsString()
  @IsOptional()
  testCaseId?: string;

  @ApiProperty({
    description: 'Test suite ID where the bug occurred',
    example: 'TS-001',
    required: false
  })
  @IsString()
  @IsOptional()
  testSuiteId?: string;

  @ApiProperty({
    description: 'Execution ID',
    example: 'EXEC-2024-001',
    required: false
  })
  @IsString()
  @IsOptional()
  executionId?: string;

  @ApiProperty({
    description: 'Name of the scenario that failed',
    example: 'Create product with valid data',
    required: false
  })
  @IsString()
  @IsOptional()
  scenarioName?: string;

  @ApiProperty({
    description: 'Name of the test case',
    example: 'TC-ECOMMERCE-01',
    required: false
  })
  @IsString()
  @IsOptional()
  testCaseName?: string;

  @ApiProperty({
    description: 'Error message',
    example: 'Internal Server Error: 500',
    required: false
  })
  @IsString()
  @IsOptional()
  errorMessage?: string;

  @ApiProperty({
    description: 'Type of error',
    example: 'HTTPError',
    required: false
  })
  @IsString()
  @IsOptional()
  errorType?: string;

  @ApiProperty({
    description: 'Error stack trace',
    required: false
  })
  @IsString()
  @IsOptional()
  errorStack?: string;

  @ApiProperty({
    description: 'Error code',
    example: '500',
    required: false
  })
  @IsString()
  @IsOptional()
  errorCode?: string;

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
    description: 'HTTP method',
    example: 'POST',
    required: false
  })
  @IsString()
  @IsOptional()
  method?: string;

  @ApiProperty({
    description: 'API endpoint',
    example: '/api/products',
    required: false
  })
  @IsString()
  @IsOptional()
  endpoint?: string;

  @ApiProperty({
    description: 'Request data that caused the error',
    required: false
  })
  @IsOptional()
  requestData?: any;

  @ApiProperty({
    description: 'Response data received',
    required: false
  })
  @IsOptional()
  responseData?: any;

  @ApiProperty({
    description: 'Execution time in milliseconds',
    example: 1500,
    required: false
  })
  @IsNumber()
  @IsOptional()
  executionTime?: number;

  @ApiProperty({
    description: 'Execution logs',
    required: false
  })
  @IsString()
  @IsOptional()
  executionLogs?: string;

  @ApiProperty({
    description: 'Console logs',
    required: false
  })
  @IsString()
  @IsOptional()
  consoleLogs?: string;

  @ApiProperty({
    description: 'Environment where the bug occurred',
    example: 'staging',
    required: false
  })
  @IsString()
  @IsOptional()
  environment?: string;

  @ApiProperty({
    description: 'Execution date',
    example: '2024-01-15T10:30:00Z',
    required: false
  })
  @IsOptional()
  executionDate?: Date;
}
