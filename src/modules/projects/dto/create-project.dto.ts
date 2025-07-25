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
    description: 'Base path for API endpoints',
    example: '/v1/api',
    default: '/v1/api',
  })
  @IsString()
  @IsOptional()
  basePath?: string;

  @ApiPropertyOptional({
    description: 'Type of project',
    enum: ProjectType,
    default: ProjectType.PLAYWRIGHT_BDD,
  })
  @IsEnum(ProjectType)
  @IsOptional()
  type?: ProjectType;
}
