import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';

/**
 * Enumeration of AI operation types for test case generation.
 */
export enum AIOperationType {
  /** Add a new scenario to existing test files */
  ADD_SCENARIO = 'add-scenario',
  /** Modify an existing scenario in test files */
  MODIFY_SCENARIO = 'modify-scenario',
  /** Create new test files from scratch */
  CREATE_NEW = 'create-new',
}

/**
 * DTO for AI generation requests.
 * Contains all necessary information to generate test cases using AI.
 */
export class AIGenerationRequestDto {
  @ApiPropertyOptional({
    description: 'Project ID (automatically injected from URL)',
  })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiProperty({
    description: 'Entity name for which to generate tests',
    example: 'Product',
  })
  @IsString()
  entityName: string;

  @ApiProperty({
    description: 'Project section',
    example: 'ecommerce',
  })
  @IsString()
  section: string;

  @ApiProperty({
    description: 'Type of operation to perform',
    enum: AIOperationType,
    example: AIOperationType.ADD_SCENARIO,
  })
  @IsEnum(AIOperationType)
  operation: AIOperationType;

  @ApiProperty({
    description: 'Specific requirements for generation',
    example: 'Create product with price 330',
  })
  @IsString()
  requirements: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for generation',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
} 