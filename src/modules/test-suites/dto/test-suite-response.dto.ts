import { ApiProperty } from '@nestjs/swagger';
import { TestSuiteType, TestSuiteStatus } from '../entities/test-suite.entity';

/**
 * DTO: API response shape for test suite records.
 */
export class TestSuiteResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the test suite',
    example: 'uuid-string'
  })
  id: string;

  @ApiProperty({
    description: 'Test suite ID',
    example: 'TS-ECOMMERCE-001'
  })
  suiteId: string;

  @ApiProperty({
    description: 'Project ID',
    example: 'project-uuid'
  })
  projectId: string;

  @ApiProperty({
    description: 'Name of the test suite',
    example: 'Product API Test Suite'
  })
  name: string;

  @ApiProperty({
    description: 'Description of the test suite',
    example: 'Comprehensive test suite for Product API endpoints'
  })
  description: string;

  @ApiProperty({
    description: 'Type of test suite',
    enum: TestSuiteType,
    example: TestSuiteType.TEST_SET
  })
  type: TestSuiteType;

  @ApiProperty({
    description: 'Status of the test suite',
    enum: TestSuiteStatus,
    example: TestSuiteStatus.PENDING
  })
  status: TestSuiteStatus;

  @ApiProperty({
    description: 'Section of the API',
    example: 'ecommerce'
  })
  section: string;

  @ApiProperty({
    description: 'Entity name',
    example: 'Product'
  })
  entity: string;

  @ApiProperty({
    description: 'Array of tags',
    example: ['smoke', 'regression']
  })
  tags: string[];

  @ApiProperty({
    description: 'Test cases included in this suite',
    example: [
      {
        testCaseId: 'TC-ECOMMERCE-01',
        name: 'Create Product',
        entityName: 'Product',
        section: 'ecommerce'
      }
    ]
  })
  testCases: Array<{
    testCaseId: string;
    name: string;
    entityName: string;
    section: string;
  }>;

  @ApiProperty({
    description: 'Test sets included in this plan (for test plans)',
    example: [
      {
        setId: 'TS-001',
        name: 'Product CRUD Tests',
        testCases: ['TC-001', 'TC-002']
      }
    ]
  })
  testSets: Array<{
    setId: string;
    name: string;
    testCases: string[];
  }>;

  @ApiProperty({
    description: 'Total number of test cases',
    example: 10
  })
  totalTestCases: number;

  @ApiProperty({
    description: 'Number of passed test cases',
    example: 8
  })
  passedTestCases: number;

  @ApiProperty({
    description: 'Number of failed test cases',
    example: 1
  })
  failedTestCases: number;

  @ApiProperty({
    description: 'Number of skipped test cases',
    example: 1
  })
  skippedTestCases: number;

  @ApiProperty({
    description: 'Total execution time in milliseconds',
    example: 45000
  })
  executionTime: number;

  @ApiProperty({
    description: 'Execution start timestamp',
    example: '2024-01-15T10:30:00Z'
  })
  startedAt: Date;

  @ApiProperty({
    description: 'Execution completion timestamp',
    example: '2024-01-15T10:35:00Z'
  })
  completedAt: Date;

  @ApiProperty({
    description: 'Last execution timestamp',
    example: '2024-01-15T10:30:00Z'
  })
  lastExecutedAt: Date;

  @ApiProperty({
    description: 'Array of error objects',
    example: []
  })
  errors: any[];

  @ApiProperty({
    description: 'Array of bug references',
    example: []
  })
  bugs: any[];

  @ApiProperty({
    description: 'Execution logs',
    example: 'Test execution logs...'
  })
  executionLogs: string;

  @ApiProperty({
    description: 'Environment for execution',
    example: 'default'
  })
  environment: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-15T10:00:00Z'
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-15T10:30:00Z'
  })
  updatedAt: Date;
}
