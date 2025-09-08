import { ApiProperty } from '@nestjs/swagger';

/**
 * Sync Details DTO
 * 
 * Contains detailed information about the synchronization process
 * including sections, entities, and any errors encountered.
 * 
 * @class SyncDetailsDto
 */
export class SyncDetailsDto {
  @ApiProperty({
    description: 'List of sections found in the project',
    example: ['ecommerce', 'auth', 'admin']
  })
  sections: string[];

  @ApiProperty({
    description: 'List of entities found in the project',
    example: ['Product', 'User', 'Order']
  })
  entities: string[];

  @ApiProperty({
    description: 'List of errors encountered during synchronization',
    example: ['Error processing Product: File not found']
  })
  errors: string[];
}

/**
 * Sync Data DTO
 * 
 * Contains the main synchronization data including statistics
 * and processing information for the synchronized project.
 * 
 * @class SyncDataDto
 */
export class SyncDataDto {
  @ApiProperty({
    description: 'ID of the synchronized project',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  projectId: string;

  @ApiProperty({
    description: 'Number of endpoints updated',
    example: 5
  })
  endpointsUpdated: number;

  @ApiProperty({
    description: 'Number of test cases synchronized',
    example: 25
  })
  testCasesSynced: number;

  @ApiProperty({
    description: 'Number of steps synchronized',
    example: 150
  })
  stepsSynced: number;

  @ApiProperty({
    description: 'Number of scenarios added without @TC-',
    example: 3
  })
  scenariosAdded: number;

  @ApiProperty({
    description: 'Processing time in milliseconds',
    example: 2500
  })
  processingTime: number;

  @ApiProperty({
    description: 'Synchronization details',
    type: SyncDetailsDto
  })
  details: SyncDetailsDto;
}

/**
 * Sync Response DTO
 * 
 * Main response structure for synchronization operations containing
 * success status, message, and detailed synchronization data.
 * 
 * @class SyncResponseDto
 */
export class SyncResponseDto {
  @ApiProperty({
    description: 'Indicates if the synchronization was successful',
    example: true
  })
  success: boolean;

  @ApiProperty({
    description: 'Descriptive message of the result',
    example: 'Project synchronized successfully in 2500ms'
  })
  message: string;

  @ApiProperty({
    description: 'Detailed synchronization data',
    type: SyncDataDto
  })
  data: SyncDataDto;
}
