import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsString,
  IsEnum,
  IsOptional,
  ValidateNested,
  IsArray,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

class PathParameter {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
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

  @ApiPropertyOptional({
    description: 'Validation rules like minLength, minimum, etc.',
  })
  @IsOptional()
  validations?: Record<string, any>;
}

class EndpointMethod {
  @ApiProperty({ enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] })
  @IsEnum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

  @ApiPropertyOptional({
    type: [FieldDefinition],
    description: 'Request body definition for POST/PUT/PATCH',
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FieldDefinition)
  requestBodyDefinition?: FieldDefinition[];

  @ApiPropertyOptional({ description: 'Method description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'If authentication is required' })
  @IsOptional()
  @IsBoolean()
  requiresAuth?: boolean;
}

export class RegisterEndpointDto {
  @ApiPropertyOptional({
    description: 'Project ID (automatically injected from URL)',
  })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Endpoint ID (descriptive identifier)' })
  @IsOptional()
  @IsString()
  endpointId?: string;

  @ApiProperty({ example: 'ecommerce' })
  @IsString()
  section: string;

  @ApiProperty({ example: 'Category' })
  @IsString()
  entityName: string;

  @ApiProperty({ example: '/categories/{id}' })
  @IsString()
  path: string;

  @ApiPropertyOptional({ type: [PathParameter] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PathParameter)
  pathParameters?: PathParameter[];

  @ApiProperty({
    type: [EndpointMethod],
    description: 'HTTP methods supported by this endpoint',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EndpointMethod)
  methods: EndpointMethod[];

  @ApiPropertyOptional({
    description: 'Descriptive name for the endpoint (e.g., "products-crud")',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'General description of the endpoint' })
  @IsOptional()
  @IsString()
  description?: string;
}
