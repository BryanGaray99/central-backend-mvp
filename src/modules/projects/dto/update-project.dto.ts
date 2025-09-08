import { IsString, IsOptional, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Data Transfer Object for updating an existing testing project.
 * 
 * This DTO defines the structure and validation rules for project update requests.
 * All fields are optional, allowing partial updates of project properties.
 * 
 * @class UpdateProjectDto
 * @since 1.0.0
 */
export class UpdateProjectDto {
  /**
   * Human-readable display name for the project.
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
  @ApiPropertyOptional({
    description: 'Base URL for testing',
    example: 'http://localhost:3000',
  })
  @IsUrl({
    require_tld: false,
    require_protocol: true,
    protocols: ['http', 'https'],
  })
  @IsOptional()
  baseUrl?: string;

  /**
   * Base path for API endpoints.
   * This path will be prepended to all API endpoint URLs in the generated tests.
   * 
   * @example '/v1/api'
   */
  @ApiPropertyOptional({
    description: 'Base path for API endpoints',
    example: '/v1/api',
  })
  @IsString()
  @IsOptional()
  basePath?: string;
}
