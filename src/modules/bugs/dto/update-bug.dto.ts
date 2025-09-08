import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { BugType, BugSeverity, BugPriority, BugStatus } from '../entities/bug.entity';

/**
 * Update Bug DTO
 * 
 * Defines the structure for updating existing bugs with optional
 * fields for title, description, status, priority, and other
 * bug properties that can be modified.
 * 
 * @class UpdateBugDto
 */
export class UpdateBugDto {
  @ApiProperty({
    description: 'Title of the bug',
    example: 'Product creation fails with 500 error',
    required: false
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({
    description: 'Detailed description of the bug',
    example: 'When creating a product with valid data, the API returns a 500 internal server error instead of 201 Created.',
    required: false
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Type of bug',
    enum: BugType,
    example: BugType.TEST_FAILURE,
    required: false
  })
  @IsEnum(BugType)
  @IsOptional()
  type?: BugType;

  @ApiProperty({
    description: 'Severity of the bug',
    enum: BugSeverity,
    example: BugSeverity.HIGH,
    required: false
  })
  @IsEnum(BugSeverity)
  @IsOptional()
  severity?: BugSeverity;

  @ApiProperty({
    description: 'Priority of the bug',
    enum: BugPriority,
    example: BugPriority.HIGH,
    required: false
  })
  @IsEnum(BugPriority)
  @IsOptional()
  priority?: BugPriority;

  @ApiProperty({
    description: 'Status of the bug',
    enum: BugStatus,
    example: BugStatus.IN_PROGRESS,
    required: false
  })
  @IsEnum(BugStatus)
  @IsOptional()
  status?: BugStatus;

  @ApiProperty({
    description: 'Error message',
    example: 'Internal Server Error: 500',
    required: false
  })
  @IsString()
  @IsOptional()
  errorMessage?: string;

  @ApiProperty({
    description: 'Type of error',
    example: 'HTTPError',
    required: false
  })
  @IsString()
  @IsOptional()
  errorType?: string;

  @ApiProperty({
    description: 'Error stack trace',
    required: false
  })
  @IsString()
  @IsOptional()
  errorStack?: string;

  @ApiProperty({
    description: 'Error code',
    example: '500',
    required: false
  })
  @IsString()
  @IsOptional()
  errorCode?: string;

  @ApiProperty({
    description: 'Request data that caused the error',
    required: false
  })
  @IsOptional()
  requestData?: any;

  @ApiProperty({
    description: 'Response data received',
    required: false
  })
  @IsOptional()
  responseData?: any;

  @ApiProperty({
    description: 'Execution logs',
    required: false
  })
  @IsString()
  @IsOptional()
  executionLogs?: string;

  @ApiProperty({
    description: 'Console logs',
    required: false
  })
  @IsString()
  @IsOptional()
  consoleLogs?: string;

  @ApiProperty({
    description: 'Environment where the bug occurred',
    example: 'staging',
    required: false
  })
  @IsString()
  @IsOptional()
  environment?: string;
}
