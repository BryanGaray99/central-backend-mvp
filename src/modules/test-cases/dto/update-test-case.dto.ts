import { ApiPropertyOptional } from '@nestjs/swagger';
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
import { TestType } from '../entities/test-case.entity';
import { HooksDto, TestCaseMetadataDto } from './create-test-case.dto';

/**
 * Data Transfer Object for updating an existing test case.
 *
 * This DTO defines the structure and validation rules for test case update requests.
 * All fields are optional, allowing partial updates of test case information.
 *
 * @class UpdateTestCaseDto
 * @since 1.0.0
 */
export class UpdateTestCaseDto {
  /**
   * New name for the test case.
   *
   * @example 'Create Product with valid data - Enhanced'
   */
  @ApiPropertyOptional({
    description: 'New name for the test case',
    example: 'Create Product with valid data - Enhanced',
  })
  @IsOptional()
  @IsString()
  name?: string;

  /**
   * New description for the test case.
   *
   * @example 'Verify that a product can be created with valid data - Enhanced version'
   */
  @ApiPropertyOptional({
    description: 'New description for the test case',
    example: 'Verify that a product can be created with valid data - Enhanced version',
  })
  @IsOptional()
  @IsString()
  description?: string;

  /**
   * New associated entity name.
   *
   * @example 'Product'
   */
  @ApiPropertyOptional({
    description: 'New associated entity name',
    example: 'Product',
  })
  @IsOptional()
  @IsString()
  entityName?: string;

  /**
   * New project section.
   *
   * @example 'ecommerce'
   */
  @ApiPropertyOptional({
    description: 'New project section',
    example: 'ecommerce',
  })
  @IsOptional()
  @IsString()
  section?: string;

  /**
   * New HTTP method.
   *
   * @example 'POST'
   */
  @ApiPropertyOptional({
    description: 'New HTTP method',
    example: 'POST',
  })
  @IsOptional()
  @IsString()
  method?: string;

  /**
   * New test type.
   */
  @ApiPropertyOptional({
    description: 'New test type',
    enum: TestType,
  })
  @IsOptional()
  @IsEnum(TestType)
  testType?: TestType;

  /**
   * New tags for the test case.
   *
   * @example ['@smoke', '@create', '@enhanced']
   */
  @ApiPropertyOptional({
    description: 'New tags for the test case',
    example: ['@smoke', '@create', '@enhanced'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  /**
   * New scenario content as Gherkin text.
   *
   * @example 'Given I have valid Product data\nWhen I create a Product\nThen the Product should be created successfully'
   */
  @ApiPropertyOptional({
    description: 'New scenario content as Gherkin text',
    example: 'Given I have valid Product data\nWhen I create a Product\nThen the Product should be created successfully',
  })
  @IsOptional()
  @IsString()
  scenario?: string;

  /**
   * New specific hooks for this test case.
   */
  @ApiPropertyOptional({
    description: 'New specific hooks for this test case',
    type: HooksDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => HooksDto)
  hooks?: HooksDto;

  /**
   * New examples for Scenario Outline.
   *
   * @example [
   *   { name: 'Product 1', price: 100 },
   *   { name: 'Product 2', price: 200 }
   * ]
   */
  @ApiPropertyOptional({
    description: 'New examples for Scenario Outline',
    type: 'array',
  })
  @IsOptional()
  examples?: Array<Record<string, any>>;

  /**
   * New additional metadata.
   */
  @ApiPropertyOptional({
    description: 'New additional metadata',
    type: TestCaseMetadataDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TestCaseMetadataDto)
  metadata?: TestCaseMetadataDto;
} 