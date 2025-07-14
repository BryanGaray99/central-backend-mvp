import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsBoolean } from 'class-validator';

export class GenerateTestsDto {
  @ApiProperty({
    description: 'Nombre de la entidad para generar tests',
    example: 'Product',
  })
  @IsString()
  entityName: string;

  @ApiProperty({
    description: 'Métodos HTTP para los que generar tests',
    example: ['POST', 'GET'],
  })
  @IsArray()
  @IsString({ each: true })
  methods: string[];

  @ApiProperty({
    description: 'Análisis del endpoint',
    type: 'object',
    additionalProperties: true,
  })
  analysis: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Ruta del proyecto para análisis',
  })
  @IsOptional()
  @IsString()
  projectPath?: string;

  @ApiPropertyOptional({
    description: 'Escenarios específicos a generar',
    example: ['Create Product', 'Update Product'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scenarios?: string[];

  @ApiPropertyOptional({
    description: 'Incluir fixtures de datos',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  includeFixtures?: boolean;

  @ApiPropertyOptional({
    description: 'Incluir schemas de validación',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  includeSchemas?: boolean;

  @ApiPropertyOptional({
    description: 'Refinar tests existentes',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  refineExisting?: boolean;
}

export class RefineTestsDto {
  @ApiProperty({
    description: 'Código existente a refinar',
    example: 'test("should create product", async () => { ... })',
  })
  @IsString()
  existingCode: string;

  @ApiProperty({
    description: 'Mejoras a aplicar',
    example: ['Agregar validaciones', 'Mejorar cobertura'],
  })
  @IsArray()
  @IsString({ each: true })
  improvements: string[];

  @ApiPropertyOptional({
    description: 'Ruta del proyecto para análisis',
  })
  @IsOptional()
  @IsString()
  projectPath?: string;
}

export class GenerateFixturesDto {
  @ApiProperty({
    description: 'Nombre de la entidad',
    example: 'Product',
  })
  @IsString()
  entityName: string;

  @ApiProperty({
    description: 'Análisis del endpoint',
    type: 'object',
    additionalProperties: true,
  })
  analysis: Record<string, any>;
}

export class GenerateSchemasDto {
  @ApiProperty({
    description: 'Nombre de la entidad',
    example: 'Product',
  })
  @IsString()
  entityName: string;

  @ApiProperty({
    description: 'Análisis del endpoint',
    type: 'object',
    additionalProperties: true,
  })
  analysis: Record<string, any>;
} 