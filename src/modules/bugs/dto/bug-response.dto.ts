import { ApiProperty } from '@nestjs/swagger';
import { BugType, BugSeverity, BugPriority, BugStatus } from '../entities/bug.entity';

/**
 * Bug Response DTO
 * 
 * Defines the structure of bug data returned by API endpoints.
 * Contains comprehensive bug information including identification,
 * classification, error details, execution context, and timestamps.
 * 
 * @class BugResponseDto
 */
export class BugResponseDto {
  @ApiProperty({
    description: 'Bug ID',
    example: 'BUG-001'
  })
  id: string;

  @ApiProperty({
    description: 'Unique bug identifier',
    example: 'BUG-ECOMMERCE-001'
  })
  bugId: string;

  @ApiProperty({
    description: 'Project ID',
    example: 'proj-123'
  })
  projectId: string;

  @ApiProperty({
    description: 'Test case ID where the bug occurred',
    example: 'TC-ECOMMERCE-01',
    required: false
  })
  testCaseId?: string;

  @ApiProperty({
    description: 'Test suite ID where the bug occurred',
    example: 'TS-001',
    required: false
  })
  testSuiteId?: string;

  @ApiProperty({
    description: 'Execution ID',
    example: 'EXEC-2024-001',
    required: false
  })
  executionId?: string;

  @ApiProperty({
    description: 'Title of the bug',
    example: 'Product creation fails with 500 error'
  })
  title: string;

  @ApiProperty({
    description: 'Detailed description of the bug',
    example: 'When creating a product with valid data, the API returns a 500 internal server error instead of 201 Created.'
  })
  description: string;

  @ApiProperty({
    description: 'Name of the scenario that failed',
    example: 'Create product with valid data',
    required: false
  })
  scenarioName?: string;

  @ApiProperty({
    description: 'Name of the test case',
    example: 'TC-ECOMMERCE-01',
    required: false
  })
  testCaseName?: string;

  @ApiProperty({
    description: 'Type of bug',
    enum: BugType,
    example: BugType.TEST_FAILURE
  })
  type: BugType;

  @ApiProperty({
    description: 'Severity of the bug',
    enum: BugSeverity,
    example: BugSeverity.HIGH
  })
  severity: BugSeverity;

  @ApiProperty({
    description: 'Priority of the bug',
    enum: BugPriority,
    example: BugPriority.HIGH
  })
  priority: BugPriority;

  @ApiProperty({
    description: 'Status of the bug',
    enum: BugStatus,
    example: BugStatus.OPEN
  })
  status: BugStatus;

  @ApiProperty({
    description: 'Error message',
    example: 'Internal Server Error: 500',
    required: false
  })
  errorMessage?: string;

  @ApiProperty({
    description: 'Type of error',
    example: 'HTTPError',
    required: false
  })
  errorType?: string;

  @ApiProperty({
    description: 'Error stack trace',
    required: false
  })
  errorStack?: string;

  @ApiProperty({
    description: 'Error code',
    example: '500',
    required: false
  })
  errorCode?: string;

  @ApiProperty({
    description: 'Section of the API',
    example: 'ecommerce',
    required: false
  })
  section?: string;

  @ApiProperty({
    description: 'Entity name',
    example: 'Product',
    required: false
  })
  entity?: string;

  @ApiProperty({
    description: 'HTTP method',
    example: 'POST',
    required: false
  })
  method?: string;

  @ApiProperty({
    description: 'API endpoint',
    example: '/api/products',
    required: false
  })
  endpoint?: string;

  @ApiProperty({
    description: 'Request data that caused the error',
    required: false
  })
  requestData?: any;

  @ApiProperty({
    description: 'Response data received',
    required: false
  })
  responseData?: any;

  @ApiProperty({
    description: 'Execution time in milliseconds',
    example: 1500,
    required: false
  })
  executionTime?: number;

  @ApiProperty({
    description: 'Execution date',
    example: '2024-01-15T10:30:00Z',
    required: false
  })
  executionDate?: Date;

  @ApiProperty({
    description: 'Execution logs',
    required: false
  })
  executionLogs?: string;

  @ApiProperty({
    description: 'Console logs',
    required: false
  })
  consoleLogs?: string;

  @ApiProperty({
    description: 'Environment where the bug occurred',
    example: 'staging',
    required: false
  })
  environment?: string;

  @ApiProperty({
    description: 'Date when the bug was reported',
    example: '2024-01-15T10:30:00Z'
  })
  reportedAt: Date;

  @ApiProperty({
    description: 'Date when the bug was resolved',
    example: '2024-01-16T14:20:00Z',
    required: false
  })
  resolvedAt?: Date;

  @ApiProperty({
    description: 'Date when the bug was created',
    example: '2024-01-15T10:30:00Z'
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Date when the bug was last updated',
    example: '2024-01-15T10:30:00Z'
  })
  updatedAt: Date;
}
