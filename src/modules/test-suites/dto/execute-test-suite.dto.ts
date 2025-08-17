import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsNumber, IsEnum } from 'class-validator';
import { TestType, TestEnvironment } from '../../test-execution/dto/execute-tests.dto';

export class ExecuteTestSuiteDto {
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
    description: 'Ejecutar pruebas en paralelo',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  parallel?: boolean = true;

  @ApiPropertyOptional({
    description: 'Timeout en milisegundos para cada prueba',
    minimum: 1000,
    maximum: 300000,
    default: 30000,
  })
  @IsOptional()
  @IsNumber()
  timeout?: number = 30000;

  @ApiPropertyOptional({
    description: 'Número de reintentos en caso de fallo',
    minimum: 0,
    maximum: 5,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  retries?: number = 1;

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
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  verbose?: boolean = true;

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
    default: 3,
  })
  @IsOptional()
  @IsNumber()
  workers?: number = 3;
}
