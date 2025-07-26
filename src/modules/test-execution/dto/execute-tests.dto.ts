import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsBoolean,
  IsNumber,
  IsUUID,
  Min,
  Max,
} from 'class-validator';

export enum TestType {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  ALL = 'all',
}

export enum TestEnvironment {
  LOCAL = 'local',
  STAGING = 'staging',
  PRODUCTION = 'production',
}

export class ExecuteTestsDto {
  @ApiPropertyOptional({
    description: 'Nombre de la entidad para ejecutar pruebas. Si no se proporciona, se ejecutarán todos los test cases del proyecto',
    example: 'Product',
  })
  @IsOptional()
  @IsString()
  entityName?: string;

  @ApiPropertyOptional({
    description: 'Método HTTP específico para filtrar casos de prueba',
    example: 'POST',
  })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({
    description: 'Tipo de pruebas a ejecutar',
    enum: TestType,
    default: TestType.ALL,
  })
  @IsOptional()
  @IsEnum(TestType)
  testType?: TestType = TestType.ALL;

  @ApiPropertyOptional({
    description: 'Tags para filtrar casos de prueba específicos',
    example: ['@smoke', '@create'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Nombre específico del escenario a ejecutar',
    example: 'Create Product with valid data',
  })
  @IsOptional()
  @IsString()
  specificScenario?: string;

  @ApiPropertyOptional({
    description: 'Ejecutar pruebas en paralelo',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  parallel?: boolean = false;

  @ApiPropertyOptional({
    description: 'Timeout en milisegundos para cada prueba',
    minimum: 1000,
    maximum: 300000,
    default: 30000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(300000)
  timeout?: number = 30000;

  @ApiPropertyOptional({
    description: 'Número de reintentos en caso de fallo',
    minimum: 0,
    maximum: 5,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  retries?: number = 0;

  @ApiPropertyOptional({
    description: 'Entorno de pruebas',
    enum: TestEnvironment,
    default: TestEnvironment.LOCAL,
  })
  @IsOptional()
  @IsEnum(TestEnvironment)
  environment?: TestEnvironment = TestEnvironment.LOCAL;

  @ApiPropertyOptional({
    description: 'Mostrar logs detallados',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  verbose?: boolean = false;

  @ApiPropertyOptional({
    description: 'Guardar logs de requests/responses',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  saveLogs?: boolean = true;

  @ApiPropertyOptional({
    description: 'Guardar payloads de requests/responses',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  savePayloads?: boolean = true;

  @ApiPropertyOptional({
    description: 'Número de workers para ejecución paralela',
    minimum: 1,
    maximum: 10,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  workers?: number = 1;
} 