import { IsString, IsOptional, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProjectDto {
  @ApiPropertyOptional({
    description: 'Nombre para mostrar del proyecto',
    example: 'Mi Proyecto de Pruebas E2E',
  })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiPropertyOptional({
    description: 'URL base para las pruebas',
    example: 'http://localhost:3000',
  })
  @IsUrl({
    require_tld: false,
    require_protocol: true,
    protocols: ['http', 'https'],
  })
  @IsOptional()
  baseUrl?: string;

  @ApiPropertyOptional({
    description: 'Base path para endpoints de API',
    example: '/v1/api',
  })
  @IsString()
  @IsOptional()
  basePath?: string;

  @ApiPropertyOptional({
    description: 'Metadatos adicionales del proyecto',
    example: { tags: ['e2e', 'api'], description: 'Pruebas E2E para API' },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
