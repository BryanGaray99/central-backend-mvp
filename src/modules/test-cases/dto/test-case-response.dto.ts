import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TestType, Priority, Complexity, TestCaseStatus } from '../entities/test-case.entity';

/**
 * Data Transfer Object for step definition response.
 *
 * This DTO defines the structure of step definitions in API responses.
 * It includes step template ID, parameters, and execution order.
 *
 * @class StepDefinitionResponseDto
 * @since 1.0.0
 */
export class StepDefinitionResponseDto {
  /**
   * ID of the step template.
   *
   * @example 'ST-ECOMMERCE-CREATE-01'
   */
  @ApiProperty({
    description: 'ID of the step template',
    example: 'ST-ECOMMERCE-CREATE-01',
  })
  stepId: string;

  /**
   * Specific parameters for this step.
   *
   * @example { productName: 'Test Product', price: 100 }
   */
  @ApiPropertyOptional({
    description: 'Specific parameters for this step',
    type: 'object',
    additionalProperties: true,
  })
  parameters?: Record<string, any>;

  /**
   * Order of the step in the scenario.
   *
   * @default 0
   */
  @ApiPropertyOptional({
    description: 'Order of the step in the scenario',
    default: 0,
  })
  order?: number;
}

/**
 * Data Transfer Object for scenario structure response.
 *
 * This DTO defines the structure of Gherkin scenarios in API responses.
 * It organizes step definitions by their Gherkin type (Given, When, Then).
 *
 * @class ScenarioStructureResponseDto
 * @since 1.0.0
 */
export class ScenarioStructureResponseDto {
  /**
   * Given steps (preconditions) of the scenario.
   */
  @ApiProperty({
    description: 'Given steps of the scenario',
    type: [StepDefinitionResponseDto],
  })
  given: StepDefinitionResponseDto[];

  /**
   * When steps (actions) of the scenario.
   */
  @ApiProperty({
    description: 'When steps of the scenario',
    type: [StepDefinitionResponseDto],
  })
  when: StepDefinitionResponseDto[];

  /**
   * Then steps (assertions) of the scenario.
   */
  @ApiProperty({
    description: 'Then steps of the scenario',
    type: [StepDefinitionResponseDto],
  })
  then: StepDefinitionResponseDto[];
}

/**
 * Data Transfer Object for test case hooks response.
 *
 * This DTO defines the structure of test case hooks in API responses.
 * It includes before/after hooks and skip default configuration.
 *
 * @class TestCaseHooksResponseDto
 * @since 1.0.0
 */
export class TestCaseHooksResponseDto {
  /**
   * Steps to execute before the scenario.
   *
   * @example ['setupDatabase', 'loginUser']
   */
  @ApiPropertyOptional({
    description: 'Steps to execute before the scenario',
    type: [String],
  })
  before?: string[];

  /**
   * Steps to execute after the scenario.
   *
   * @example ['cleanupData', 'logoutUser']
   */
  @ApiPropertyOptional({
    description: 'Steps to execute after the scenario',
    type: [String],
  })
  after?: string[];

  /**
   * Whether to skip automatic hooks.
   *
   * @default false
   */
  @ApiPropertyOptional({
    description: 'Whether to skip automatic hooks',
    default: false,
  })
  skipDefault?: boolean;
}

/**
 * Data Transfer Object for test case metadata response.
 *
 * This DTO defines the structure of test case metadata in API responses.
 * It includes priority, complexity, estimated duration, and dependencies.
 *
 * @class TestCaseMetadataResponseDto
 * @since 1.0.0
 */
export class TestCaseMetadataResponseDto {
  /**
   * Priority of the test case.
   */
  @ApiPropertyOptional({
    description: 'Priority of the test case',
    enum: Priority,
  })
  priority?: Priority;

  /**
   * Complexity of the test case.
   */
  @ApiPropertyOptional({
    description: 'Complexity of the test case',
    enum: Complexity,
  })
  complexity?: Complexity;

  /**
   * Estimated duration in milliseconds.
   *
   * @example 30000
   */
  @ApiPropertyOptional({
    description: 'Estimated duration in milliseconds',
    minimum: 100,
    maximum: 300000,
  })
  estimatedDuration?: number;

  /**
   * Dependencies of the test case.
   *
   * @example ['TC-ECOMMERCE-02', 'TC-ECOMMERCE-03']
   */
  @ApiPropertyOptional({
    description: 'Dependencies of the test case',
    type: [String],
  })
  dependencies?: string[];
}

/**
 * Data Transfer Object for test case response.
 *
 * This DTO defines the structure of test case data in API responses.
 * It includes all test case information including scenario, hooks, metadata,
 * and execution history.
 *
 * @class TestCaseResponseDto
 * @since 1.0.0
 */
export class TestCaseResponseDto {
  /**
   * Unique ID of the test case.
   *
   * @example 'uuid'
   */
  @ApiProperty({
    description: 'Unique ID of the test case',
    example: 'uuid',
  })
  id: string;

  /**
   * Test case identifier.
   *
   * @example 'TC-ECOMMERCE-01'
   */
  @ApiProperty({
    description: 'Test case identifier',
    example: 'TC-ECOMMERCE-01',
  })
  testCaseId: string;

  /**
   * Project ID.
   *
   * @example 'uuid'
   */
  @ApiProperty({
    description: 'Project ID',
    example: 'uuid',
  })
  projectId: string;

  /**
   * Entity name.
   *
   * @example 'Product'
   */
  @ApiProperty({
    description: 'Entity name',
    example: 'Product',
  })
  entityName: string;

  /**
   * Project section.
   *
   * @example 'ecommerce'
   */
  @ApiProperty({
    description: 'Project section',
    example: 'ecommerce',
  })
  section: string;

  /**
   * Name of the test case.
   *
   * @example 'Create Product with valid data'
   */
  @ApiProperty({
    description: 'Name of the test case',
    example: 'Create Product with valid data',
  })
  name: string;

  /**
   * Description of the test case.
   *
   * @example 'Verify that a product can be created with valid data'
   */
  @ApiProperty({
    description: 'Description of the test case',
    example: 'Verify that a product can be created with valid data',
  })
  description: string;

  /**
   * Tags of the test case.
   *
   * @example ['@smoke', '@create']
   */
  @ApiProperty({
    description: 'Tags of the test case',
    example: ['@smoke', '@create'],
  })
  tags: string[];

  /**
   * HTTP method.
   *
   * @example 'POST'
   */
  @ApiProperty({
    description: 'HTTP method',
    example: 'POST',
  })
  method: string;

  /**
   * Type of test.
   */
  @ApiProperty({
    description: 'Type of test',
    enum: TestType,
  })
  testType: TestType;

  /**
   * Scenario content as Gherkin text.
   *
   * @example 'Given I have valid Product data\nWhen I create a Product\nThen the Product should be created successfully'
   */
  @ApiProperty({
    description: 'Scenario content as Gherkin text',
    example: 'Given I have valid Product data\nWhen I create a Product\nThen the Product should be created successfully',
  })
  scenario: string;

  /**
   * Specific hooks for this test case.
   */
  @ApiPropertyOptional({
    description: 'Specific hooks for this test case',
    type: TestCaseHooksResponseDto,
  })
  hooks?: TestCaseHooksResponseDto;

  /**
   * Examples for Scenario Outline.
   *
   * @example [
   *   { name: 'Product 1', price: 100 },
   *   { name: 'Product 2', price: 200 }
   * ]
   */
  @ApiPropertyOptional({
    description: 'Examples for Scenario Outline',
    type: 'array',
  })
  examples?: Array<Record<string, any>>;

  /**
   * Status of the test case.
   */
  @ApiProperty({
    description: 'Status of the test case',
    enum: TestCaseStatus,
  })
  status: TestCaseStatus;

  /**
   * Date of the last execution.
   *
   * @example '2024-01-01T00:00:00Z'
   */
  @ApiPropertyOptional({
    description: 'Date of the last execution',
    example: '2024-01-01T00:00:00Z',
  })
  lastRun?: Date;

  /**
   * Status of the last execution.
   *
   * @example 'passed'
   */
  @ApiPropertyOptional({
    description: 'Status of the last execution',
    example: 'passed',
  })
  lastRunStatus?: string;

  /**
   * Additional metadata.
   */
  @ApiPropertyOptional({
    description: 'Additional metadata',
    type: TestCaseMetadataResponseDto,
  })
  metadata?: TestCaseMetadataResponseDto;

  /**
   * Creation date.
   *
   * @example '2024-01-01T00:00:00Z'
   */
  @ApiProperty({
    description: 'Creation date',
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  /**
   * Last update date.
   *
   * @example '2024-01-01T00:00:00Z'
   */
  @ApiProperty({
    description: 'Last update date',
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;
} 