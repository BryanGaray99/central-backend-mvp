import { ApiProperty, ApiPropertyOptional, ApiExtraModels } from '@nestjs/swagger';
import { StepType, StepTemplateType, Reusability, StepStatus } from '../entities/test-step.entity';

/**
 * Data Transfer Object for step parameter response.
 *
 * This DTO defines the structure of step parameters in API responses.
 * It includes parameter metadata such as type, requirements, and configuration.
 *
 * @class StepParameterResponseDto
 * @since 1.0.0
 */
@ApiExtraModels()
export class StepParameterResponseDto {
  /**
   * Name of the parameter.
   *
   * @example 'entityName'
   */
  @ApiProperty({
    description: 'Name of the parameter',
    example: 'entityName',
  })
  name: string;

  /**
   * Type of the parameter.
   */
  @ApiProperty({
    description: 'Type of the parameter',
    enum: ['string', 'number', 'boolean', 'object'],
  })
  type: 'string' | 'number' | 'boolean' | 'object';

  /**
   * Whether the parameter is required.
   *
   * @default true
   */
  @ApiProperty({
    description: 'Whether the parameter is required',
    default: true,
  })
  required: boolean;

  /**
   * Default value of the parameter.
   */
  @ApiPropertyOptional({
    description: 'Default value of the parameter',
  })
  defaultValue?: any;

  /**
   * Conditional rules for the parameter.
   */
  @ApiPropertyOptional({
    description: 'Conditional rules for the parameter',
    type: 'object',
    additionalProperties: true,
  })
  conditional?: any;

  /**
   * Dynamic configuration for the parameter.
   */
  @ApiPropertyOptional({
    description: 'Dynamic configuration for the parameter',
    type: 'object',
    additionalProperties: true,
  })
  dynamic?: any;
}

/**
 * Data Transfer Object for step validation response.
 *
 * This DTO defines the structure of step validation rules in API responses.
 * It includes test code, expected results, and timeout configuration.
 *
 * @class StepValidationResponseDto
 * @since 1.0.0
 */
export class StepValidationResponseDto {
  /**
   * Test code for validation.
   *
   * @example 'const step = new Step("ST-ECOMMERCE-CREATE-01"); expect(step.isValid()).toBe(true);'
   */
  @ApiProperty({
    description: 'Test code for validation',
    example: 'const step = new Step("ST-ECOMMERCE-CREATE-01"); expect(step.isValid()).toBe(true);',
  })
  testCode: string;

  /**
   * Expected result of the validation.
   */
  @ApiProperty({
    description: 'Expected result of the validation',
  })
  expectedResult: any;

  /**
   * Timeout in milliseconds.
   *
   * @example 5000
   */
  @ApiProperty({
    description: 'Timeout in milliseconds',
    minimum: 100,
    maximum: 30000,
  })
  timeout: number;
}

/**
 * Data Transfer Object for step validation configuration response.
 *
 * This DTO defines the structure of step validation configuration in API responses.
 * It includes different types of validation rules (syntax, runtime, integration).
 *
 * @class StepValidationConfigResponseDto
 * @since 1.0.0
 */
export class StepValidationConfigResponseDto {
  /**
   * Syntax validation configuration.
   */
  @ApiPropertyOptional({
    description: 'Syntax validation configuration',
    type: StepValidationResponseDto,
  })
  syntax?: StepValidationResponseDto;

  /**
   * Runtime validation configuration.
   */
  @ApiPropertyOptional({
    description: 'Runtime validation configuration',
    type: StepValidationResponseDto,
  })
  runtime?: StepValidationResponseDto;

  /**
   * Integration validation configuration.
   */
  @ApiPropertyOptional({
    description: 'Integration validation configuration',
    type: StepValidationResponseDto,
  })
  integration?: StepValidationResponseDto;
}

/**
 * Data Transfer Object for step metadata response.
 *
 * This DTO defines the structure of step metadata in API responses.
 * It includes category, complexity, and reusability information.
 *
 * @class StepMetadataResponseDto
 * @since 1.0.0
 */
export class StepMetadataResponseDto {
  /**
   * Category of the step.
   *
   * @example 'validation'
   */
  @ApiPropertyOptional({
    description: 'Category of the step',
    example: 'validation',
  })
  category?: string;

  /**
   * Complexity of the step.
   */
  @ApiPropertyOptional({
    description: 'Complexity of the step',
    enum: ['simple', 'medium', 'complex'],
  })
  complexity?: 'simple' | 'medium' | 'complex';

  /**
   * Reusability level of the step.
   */
  @ApiPropertyOptional({
    description: 'Reusability level of the step',
    enum: Reusability,
  })
  reusability?: Reusability;
}

/**
 * Data Transfer Object for test step response.
 *
 * This DTO defines the structure of test step data in API responses.
 * It includes all step information including definition, implementation,
 * parameters, validation, and metadata.
 *
 * @class TestStepResponseDto
 * @since 1.0.0
 */
@ApiExtraModels()
export class TestStepResponseDto {
  /**
   * Unique ID of the step.
   *
   * @example 'uuid'
   */
  @ApiProperty({
    description: 'Unique ID of the step',
    example: 'uuid',
  })
  id: string;

  /**
   * Step template ID.
   *
   * @example 'ST-ECOMMERCE-CREATE-01'
   */
  @ApiProperty({
    description: 'Step template ID',
    example: 'ST-ECOMMERCE-CREATE-01',
  })
  stepId: string;

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
   * Name of the step.
   *
   * @example 'I create a {entityName}'
   */
  @ApiProperty({
    description: 'Name of the step',
    example: 'I create a {entityName}',
  })
  name: string;

  /**
   * Step definition in natural language.
   *
   * @example 'I create a {entityName}'
   */
  @ApiProperty({
    description: 'Step definition in natural language',
    example: 'I create a {entityName}',
  })
  definition: string;

  /**
   * Type of step.
   */
  @ApiProperty({
    description: 'Type of step',
    enum: StepType,
  })
  type: StepType;

  /**
   * Type of step template.
   */
  @ApiProperty({
    description: 'Type of step template',
    enum: StepTemplateType,
  })
  stepType: StepTemplateType;

  /**
   * Parameters of the step.
   */
  @ApiProperty({
    description: 'Parameters of the step',
    type: [StepParameterResponseDto],
  })
  parameters: StepParameterResponseDto[];

  /**
   * Implementation of the step in code.
   *
   * @example 'async function(entityName) { const client = this.getClient(entityName); const data = this[`${entityName.toLowerCase()}Data`]; const response = await client.create(data); this.lastResponse = response; }'
   */
  @ApiProperty({
    description: 'Implementation of the step in code',
    example: 'async function(entityName) { const client = this.getClient(entityName); const data = this[`${entityName.toLowerCase()}Data`]; const response = await client.create(data); this.lastResponse = response; }',
  })
  implementation: string;

  /**
   * Validation configuration.
   */
  @ApiPropertyOptional({
    description: 'Validation configuration',
    type: StepValidationConfigResponseDto,
  })
  validation?: StepValidationConfigResponseDto;

  /**
   * Status of the step.
   */
  @ApiProperty({
    description: 'Status of the step',
    enum: StepStatus,
  })
  status: StepStatus;

  /**
   * Metadata of the step.
   */
  @ApiPropertyOptional({
    description: 'Metadata of the step',
    type: StepMetadataResponseDto,
  })
  metadata?: StepMetadataResponseDto;

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