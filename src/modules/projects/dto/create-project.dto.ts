import { IsString, IsEnum, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectType } from '../project.entity';

export class CreateProjectDto {
  @ApiProperty({
    description: 'Unique identifier for the project (used for the workspace)',
    example: 'my-test-project',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Display name for the project',
    example: 'My E2E Testing Project',
  })
  @IsString()
  @IsOptional()
  displayName?: string;

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

  @ApiPropertyOptional({
    description: 'Type of project',
    enum: ProjectType,
    default: ProjectType.PLAYWRIGHT_BDD,
  })
  @IsEnum(ProjectType)
  @IsOptional()
  type?: ProjectType;

  @ApiPropertyOptional({
    description: 'Additional project metadata',
    example: { tags: ['e2e', 'api'], description: 'E2E tests for API' },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
