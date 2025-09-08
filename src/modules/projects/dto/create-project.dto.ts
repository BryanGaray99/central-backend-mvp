import { IsString, IsEnum, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectType } from '../project.entity';

/**
 * Data Transfer Object for creating a new testing project.
 * 
 * This DTO defines the structure and validation rules for project creation requests.
 * It includes all necessary fields to create a fully functional testing project
 * with proper workspace setup and configuration.
 * 
 * @class CreateProjectDto
 * @since 1.0.0
 */
export class CreateProjectDto {
  /**
   * Unique identifier for the project (used for the workspace).
   * This name will be used to create the workspace directory and must be unique.
   * 
   * @example 'my-test-project'
   */
  @ApiProperty({
    description: 'Unique identifier for the project (used for the workspace)',
    example: 'my-test-project',
  })
  @IsString()
  name: string;

  /**
   * Human-readable display name for the project.
   * If not provided, the name field will be used as the display name.
   * 
   * @example 'My E2E Testing Project'
   */
  @ApiPropertyOptional({
    description: 'Display name for the project',
    example: 'My E2E Testing Project',
  })
  @IsString()
  @IsOptional()
  displayName?: string;

  /**
   * Base URL for API testing.
   * This URL will be used as the target for all API requests in the generated tests.
   * 
   * @example 'http://localhost:3000'
   */
  @ApiProperty({
    description: 'Base URL for testing',
    example: 'http://localhost:3000',
  })
  @IsUrl({
    require_tld: false,
    require_protocol: true,
    protocols: ['http', 'https'],
  })
  baseUrl: string;

  /**
   * Base path for API endpoints.
   * This path will be prepended to all API endpoint URLs in the generated tests.
   * 
   * @example '/v1/api'
   * @default '/v1/api'
   */
  @ApiPropertyOptional({
    description: 'Base path for API endpoints',
    example: '/v1/api',
    default: '/v1/api',
  })
  @IsString()
  @IsOptional()
  basePath?: string;

  /**
   * Type of testing project to create.
   * Determines the testing framework and structure to be generated.
   * 
   * @example ProjectType.PLAYWRIGHT_BDD
   * @default ProjectType.PLAYWRIGHT_BDD
   */
  @ApiPropertyOptional({
    description: 'Type of project',
    enum: ProjectType,
    default: ProjectType.PLAYWRIGHT_BDD,
  })
  @IsEnum(ProjectType)
  @IsOptional()
  type?: ProjectType;
}
