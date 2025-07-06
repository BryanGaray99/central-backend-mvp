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

export enum BrowserType {
  CHROMIUM = 'chromium',
  FIREFOX = 'firefox',
  WEBKIT = 'webkit',
  ALL = 'all',
}

export class ExecuteTestsDto {
  @ApiProperty({
    description: 'Nombre de la entidad para ejecutar pruebas',
    example: 'Product',
  })
  @IsString()
  entityName: string;

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
    description: 'Navegador a usar para las pruebas',
    enum: BrowserType,
    default: BrowserType.CHROMIUM,
  })
  @IsOptional()
  @IsEnum(BrowserType)
  browser?: BrowserType = BrowserType.CHROMIUM;

  @ApiPropertyOptional({
    description: 'Ejecutar en modo headless',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  headless?: boolean = true;

  @ApiPropertyOptional({
    description: 'Grabar video de las pruebas',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  video?: boolean = false;

  @ApiPropertyOptional({
    description: 'Tomar screenshots en caso de fallo',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  screenshots?: boolean = true;

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