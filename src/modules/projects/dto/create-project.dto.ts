import { IsString, IsEnum, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectType } from '../project.entity';

export class CreateProjectDto {
  @ApiProperty({
    description: 'Identificador único del proyecto (usado para el workspace)',
    example: 'mi-proyecto-test'
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Nombre para mostrar del proyecto',
    example: 'Mi Proyecto de Pruebas E2E'
  })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiProperty({
    description: 'URL base para las pruebas',
    example: 'http://localhost:3000'
  })
  @IsUrl({
    require_tld: false,
    require_protocol: true,
    protocols: ['http', 'https']
  })
  baseUrl: string;

  @ApiPropertyOptional({
    description: 'Tipo de proyecto',
    enum: ProjectType,
    default: ProjectType.PLAYWRIGHT_BDD
  })
  @IsEnum(ProjectType)
  @IsOptional()
  type?: ProjectType;

  @ApiPropertyOptional({
    description: 'Metadatos adicionales del proyecto',
    example: { tags: ['e2e', 'api'], description: 'Pruebas E2E para API' }
  })
  @IsOptional()
  metadata?: Record<string, any>;
} 