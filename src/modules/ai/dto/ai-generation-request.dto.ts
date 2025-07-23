import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';

export enum AIOperationType {
  ADD_SCENARIO = 'add-scenario',
  MODIFY_SCENARIO = 'modify-scenario',
  CREATE_NEW = 'create-new',
}

export class AIGenerationRequestDto {
  @ApiPropertyOptional({
    description: 'ID del proyecto (se inyecta automáticamente desde la URL)',
  })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiProperty({
    description: 'Nombre de la entidad para la cual generar tests',
    example: 'Product',
  })
  @IsString()
  entityName: string;

  @ApiProperty({
    description: 'Sección del proyecto',
    example: 'ecommerce',
  })
  @IsString()
  section: string;

  @ApiProperty({
    description: 'Tipo de operación a realizar',
    enum: AIOperationType,
    example: AIOperationType.ADD_SCENARIO,
  })
  @IsEnum(AIOperationType)
  operation: AIOperationType;

  @ApiProperty({
    description: 'Requisitos específicos para la generación',
    example: 'Crear producto con precio 330',
  })
  @IsString()
  requirements: string;

  @ApiPropertyOptional({
    description: 'Metadatos adicionales para la generación',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
} 