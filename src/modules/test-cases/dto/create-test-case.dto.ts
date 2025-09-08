import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  IsEnum,
  IsOptional,
  ValidateNested,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TestType, Priority, Complexity } from '../entities/test-case.entity';

/**
 * Data Transfer Object for step definition in test case creation.
 *
 * This DTO defines the structure for step definitions used in test case scenarios.
 * It includes the step template ID, parameters, and execution order.
 *
 * @class StepDefinitionDto
 * @since 1.0.0
 */
export class StepDefinitionDto {
  /**
   * ID of the step template to use.
   *
   * @example 'ST-ECOMMERCE-CREATE-01'
   */
  @ApiProperty({
    description: 'ID of the step template',
    example: 'ST-ECOMMERCE-CREATE-01',
  })
  @IsString()
  stepId: string;

  /**
   * Specific parameters for this step instance.
   *
   * @example { productName: 'Test Product', price: 100 }
   */
  @ApiPropertyOptional({
    description: 'Specific parameters for this step',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  parameters?: Record<string, any>;

  /**
   * Execution order of the step within the scenario.
   *
   * @default 0
   * @example 1
   */
  @ApiPropertyOptional({
    description: 'Order of the step in the scenario',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  order?: number = 0;
}

/**
 * Data Transfer Object for scenario structure in test case creation.
 *
 * This DTO defines the structure of a Gherkin scenario with Given, When, and Then steps.
 * It organizes step definitions by their Gherkin type for proper test execution.
 *
 * @class ScenarioStructureDto
 * @since 1.0.0
 */
export class ScenarioStructureDto {
  /**
   * Given steps (preconditions) for the scenario.
   */
  @ApiProperty({
    description: 'Given steps of the scenario',
    type: [StepDefinitionDto],
  })
  @ValidateNested({ each: true })
  @Type(() => StepDefinitionDto)
  given: StepDefinitionDto[];

  /**
   * When steps (actions) for the scenario.
   */
  @ApiProperty({
    description: 'When steps of the scenario',
    type: [StepDefinitionDto],
  })
  @ValidateNested({ each: true })
  @Type(() => StepDefinitionDto)
  when: StepDefinitionDto[];

  /**
   * Then steps (assertions) for the scenario.
   */
  @ApiProperty({
    description: 'Then steps of the scenario',
    type: [StepDefinitionDto],
  })
  @ValidateNested({ each: true })
  @Type(() => StepDefinitionDto)
  then: StepDefinitionDto[];
}

/**
 * Data Transfer Object for test case hooks configuration.
 *
 * This DTO defines the hooks that can be executed before and after test scenarios.
 * It allows customization of test execution flow and setup/teardown operations.
 *
 * @class HooksDto
 * @since 1.0.0
 */
export class HooksDto {
  /**
   * Steps to execute before the scenario.
   *
   * @example ['setupDatabase', 'loginUser']
   */
  @ApiPropertyOptional({
    description: 'Steps to execute before the scenario',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
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
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
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
  @IsOptional()
  skipDefault?: boolean;
}

/**
 * Data Transfer Object for test case metadata.
 *
 * This DTO defines additional metadata for test cases including priority,
 * complexity, estimated duration, and dependencies.
 *
 * @class TestCaseMetadataDto
 * @since 1.0.0
 */
export class TestCaseMetadataDto {
  /**
   * Priority level of the test case.
   */
  @ApiPropertyOptional({
    description: 'Priority of the test case',
    enum: Priority,
  })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  /**
   * Complexity level of the test case.
   */
  @ApiPropertyOptional({
    description: 'Complexity of the test case',
    enum: Complexity,
  })
  @IsOptional()
  @IsEnum(Complexity)
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
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(300000)
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
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dependencies?: string[];
}

/**
 * Data Transfer Object for creating a new test case.
 *
 * This DTO defines the structure and validation rules for test case creation requests.
 * It includes all necessary information to create a comprehensive test case with
 * Gherkin scenarios, hooks, and metadata.
 *
 * @class CreateTestCaseDto
 * @since 1.0.0
 */
export class CreateTestCaseDto {
  /**
   * Project ID (ignored if provided in body; use path param instead).
   *
   * @example 'aa15e5fd-b5b7-4989-b33b-982bd2a38398'
   */
  @ApiPropertyOptional({
    description: 'Project ID (ignored if provided in body; use path param instead)',
    example: 'aa15e5fd-b5b7-4989-b33b-982bd2a38398',
  })
  @IsOptional()
  @IsString()
  projectId?: string;

  /**
   * Test Case ID (used for AI-generated test cases).
   *
   * @example 'TC-ecommerce-Product-11'
   */
  @ApiPropertyOptional({
    description: 'Test Case ID (used for AI-generated test cases)',
    example: 'TC-ecommerce-Product-11',
  })
  @IsOptional()
  @IsString()
  testCaseId?: string;

  /**
   * Name of the test case.
   *
   * @example 'Create Product with valid data'
   */
  @ApiProperty({
    description: 'Name of the test case',
    example: 'Create Product with valid data',
  })
  @IsString()
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
  @IsString()
  description: string;

  /**
   * Associated entity name.
   *
   * @example 'Product'
   */
  @ApiProperty({
    description: 'Associated entity name',
    example: 'Product',
  })
  @IsString()
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
  @IsString()
  section: string;

  /**
   * HTTP method.
   *
   * @example 'POST'
   */
  @ApiProperty({
    description: 'HTTP method',
    example: 'POST',
  })
  @IsString()
  method: string;

  /**
   * Type of test.
   *
   * @default TestType.POSITIVE
   */
  @ApiProperty({
    description: 'Type of test',
    enum: TestType,
    default: TestType.POSITIVE,
  })
  @IsEnum(TestType)
  testType: TestType = TestType.POSITIVE;

  /**
   * Tags for the test case.
   *
   * @example ['@smoke', '@create']
   */
  @ApiProperty({
    description: 'Tags for the test case',
    example: ['@smoke', '@create'],
  })
  @IsArray()
  @IsString({ each: true })
  tags: string[];

  /**
   * Scenario content as Gherkin text.
   *
   * @example 'Given I have valid Product data\nWhen I create a Product\nThen the Product should be created successfully'
   */
  @ApiProperty({
    description: 'Scenario content as Gherkin text',
    example: 'Given I have valid Product data\nWhen I create a Product\nThen the Product should be created successfully',
  })
  @IsString()
  scenario: string;

  /**
   * Specific hooks for this test case.
   */
  @ApiPropertyOptional({
    description: 'Specific hooks for this test case',
    type: HooksDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => HooksDto)
  hooks?: HooksDto;

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
  @IsOptional()
  examples?: Array<Record<string, any>>;

  /**
   * Additional metadata.
   */
  @ApiPropertyOptional({
    description: 'Additional metadata',
    type: TestCaseMetadataDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TestCaseMetadataDto)
  metadata?: TestCaseMetadataDto;
} 