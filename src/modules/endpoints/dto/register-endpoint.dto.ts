import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsUUID, IsEnum, IsOptional, ValidateNested, IsNumber } from 'class-validator';

class PathParameter {
  @ApiProperty()
  @IsString()
  name: string;
  
  @ApiProperty()
  value: string | number;
}

class FieldDefinition {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: ['string', 'number', 'boolean', 'object', 'array'] })
  @IsEnum(['string', 'number', 'boolean', 'object', 'array'])
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';

  @ApiPropertyOptional()
  @IsOptional()
  example?: any;

  @ApiPropertyOptional({ description: 'Validation rules like minLength, minimum, etc.' })
  @IsOptional()
  validations?: Record<string, any>;
}

export class RegisterEndpointDto {
  @ApiProperty()
  @IsUUID()
  projectId: string;

  @ApiProperty({ example: 'ecommerce' })
  @IsString()
  section: string;

  @ApiProperty({ example: 'Category' })
  @IsString()
  entityName: string;

  @ApiProperty({ example: '/v1/api/categories/{id}' })
  @IsString()
  path: string;

  @ApiProperty({ enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] })
  @IsEnum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

  @ApiPropertyOptional({ type: [PathParameter] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PathParameter)
  pathParameters?: PathParameter[];

  @ApiPropertyOptional({ type: [FieldDefinition], description: 'Detailed request body definition for POST/PUT/PATCH' })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FieldDefinition)
  requestBodyDefinition?: FieldDefinition[];
} 