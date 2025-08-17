import { ApiProperty } from '@nestjs/swagger';

export class SyncDetailsDto {
  @ApiProperty({
    description: 'Lista de secciones encontradas en el proyecto',
    example: ['ecommerce', 'auth', 'admin']
  })
  sections: string[];

  @ApiProperty({
    description: 'Lista de entidades encontradas en el proyecto',
    example: ['Product', 'User', 'Order']
  })
  entities: string[];

  @ApiProperty({
    description: 'Lista de errores encontrados durante la sincronización',
    example: ['Error procesando Product: Archivo no encontrado']
  })
  errors: string[];
}

export class SyncDataDto {
  @ApiProperty({
    description: 'ID del proyecto sincronizado',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  projectId: string;

  @ApiProperty({
    description: 'Número de endpoints actualizados',
    example: 5
  })
  endpointsUpdated: number;

  @ApiProperty({
    description: 'Número de test cases sincronizados',
    example: 25
  })
  testCasesSynced: number;

  @ApiProperty({
    description: 'Número de steps sincronizados',
    example: 150
  })
  stepsSynced: number;

  @ApiProperty({
    description: 'Número de scenarios agregados sin @TC-',
    example: 3
  })
  scenariosAdded: number;

  @ApiProperty({
    description: 'Tiempo de procesamiento en milisegundos',
    example: 2500
  })
  processingTime: number;

  @ApiProperty({
    description: 'Detalles de la sincronización',
    type: SyncDetailsDto
  })
  details: SyncDetailsDto;
}

export class SyncResponseDto {
  @ApiProperty({
    description: 'Indica si la sincronización fue exitosa',
    example: true
  })
  success: boolean;

  @ApiProperty({
    description: 'Mensaje descriptivo del resultado',
    example: 'Proyecto sincronizado exitosamente en 2500ms'
  })
  message: string;

  @ApiProperty({
    description: 'Datos detallados de la sincronización',
    type: SyncDataDto
  })
  data: SyncDataDto;
}
