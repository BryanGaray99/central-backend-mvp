import { ApiProperty, ApiExtraModels } from '@nestjs/swagger';
import { StepType, StepStatus, StepTemplateType } from '../entities/test-step.entity';

/**
 * Data Transfer Object for test step list response.
 *
 * This DTO defines the structure of test step data in list API responses.
 * It includes all step information for display in lists and tables.
 *
 * @class TestStepListResponseDto
 * @since 1.0.0
 */
@ApiExtraModels()
export class TestStepListResponseDto {
  /**
   * Test step ID.
   *
   * @example 'uuid'
   */
  @ApiProperty({ description: 'Test step ID' })
  id: string;

  /**
   * Unique step identifier.
   *
   * @example 'ST-ECOMMERCE-CREATE-01'
   */
  @ApiProperty({ description: 'Unique step identifier' })
  stepId: string;

  /**
   * Project ID.
   *
   * @example 'uuid'
   */
  @ApiProperty({ description: 'Project ID' })
  projectId: string;

  /**
   * Section name.
   *
   * @example 'ecommerce'
   */
  @ApiProperty({ description: 'Section name' })
  section: string;

  /**
   * Entity name.
   *
   * @example 'Product'
   */
  @ApiProperty({ description: 'Entity name' })
  entityName: string;

  /**
   * Step name.
   *
   * @example 'I create a {entityName}'
   */
  @ApiProperty({ description: 'Step name' })
  name: string;

  /**
   * Step definition.
   *
   * @example 'I create a {entityName}'
   */
  @ApiProperty({ description: 'Step definition' })
  definition: string;

  /**
   * Step type.
   */
  @ApiProperty({ description: 'Step type', enum: StepType })
  type: StepType;

  /**
   * Step template type.
   */
  @ApiProperty({ description: 'Step template type', enum: StepTemplateType })
  stepType: StepTemplateType;

  /**
   * Step parameters.
   *
   * @example [
   *   { name: 'entityName', type: 'string', required: true },
   *   { name: 'price', type: 'number', required: false }
   * ]
   */
  @ApiProperty({ description: 'Step parameters' })
  parameters: any[];

  /**
   * Step implementation.
   *
   * @example 'async function(entityName) { ... }'
   */
  @ApiProperty({ description: 'Step implementation' })
  implementation: string;

  /**
   * Step validation configuration.
   */
  @ApiProperty({ description: 'Step validation', required: false })
  validation?: any;

  /**
   * Step status.
   */
  @ApiProperty({ description: 'Step status', enum: StepStatus })
  status: StepStatus;

  /**
   * Step metadata.
   */
  @ApiProperty({ description: 'Step metadata', required: false })
  metadata?: any;

  /**
   * Creation date.
   *
   * @example '2024-01-01T00:00:00Z'
   */
  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  /**
   * Last update date.
   *
   * @example '2024-01-01T00:00:00Z'
   */
  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;
} 