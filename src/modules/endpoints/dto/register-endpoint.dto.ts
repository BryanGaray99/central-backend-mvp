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

/**
 * Path parameter definition for endpoint registration.
 * 
 * @class PathParameter
 * @since 1.0.0
 */
class PathParameter {
  /** Parameter name */
  @ApiProperty()
  @IsString()
  name: string;

  /** Parameter value */
  @ApiProperty()
  @IsString()
  value: string | number;
}

/**
 * Field definition for request body validation.
 * 
 * @class FieldDefinition
 * @since 1.0.0
 */
class FieldDefinition {
  /** Field name */
  @ApiProperty()
  @IsString()
  name: string;

  /** Field type */
  @ApiProperty({ enum: ['string', 'number', 'boolean', 'object', 'array'] })
  @IsEnum(['string', 'number', 'boolean', 'object', 'array'])
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';

  /** Example value for the field */
  @ApiPropertyOptional()
  @IsOptional()
  example?: any;

  /** Validation rules for the field */
  @ApiPropertyOptional({
    description: 'Validation rules like minLength, minimum, etc.',
  })
  @IsOptional()
  validations?: Record<string, any>;
}

/**
 * HTTP method configuration for endpoint registration.
 * 
 * @class EndpointMethod
 * @since 1.0.0
 */
class EndpointMethod {
  /** HTTP method */
  @ApiProperty({ enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] })
  @IsEnum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

  /** Request body definition for methods that require it */
  @ApiPropertyOptional({
    type: [FieldDefinition],
    description: 'Request body definition for POST/PUT/PATCH',
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FieldDefinition)
  requestBodyDefinition?: FieldDefinition[];

  /** Method description */
  @ApiPropertyOptional({ description: 'Method description' })
  @IsOptional()
  @IsString()
  description?: string;

  /** Whether authentication is required for this method */
  @ApiPropertyOptional({ description: 'If authentication is required' })
  @IsOptional()
  @IsBoolean()
  requiresAuth?: boolean;
}

/**
 * Data Transfer Object for registering an API endpoint.
 * 
 * This DTO defines the structure and validation rules for endpoint registration
 * requests. It includes endpoint configuration, HTTP methods, and validation
 * rules for request bodies.
 * 
 * @class RegisterEndpointDto
 * @since 1.0.0
 */
export class RegisterEndpointDto {
  /** Project ID (automatically injected from URL) */
  @ApiPropertyOptional({
    description: 'Project ID (automatically injected from URL)',
  })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  /** Endpoint ID (descriptive identifier) */
  @ApiPropertyOptional({ description: 'Endpoint ID (descriptive identifier)' })
  @IsOptional()
  @IsString()
  endpointId?: string;

  /** Section or module this endpoint belongs to */
  @ApiProperty({ example: 'ecommerce' })
  @IsString()
  section: string;

  /** Name of the entity this endpoint manages */
  @ApiProperty({ example: 'Category' })
  @IsString()
  entityName: string;

  /** API path for this endpoint */
  @ApiProperty({ example: '/categories/{id}' })
  @IsString()
  path: string;

  /** Path parameters for this endpoint */
  @ApiPropertyOptional({ type: [PathParameter] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PathParameter)
  pathParameters?: PathParameter[];

  /** HTTP methods supported by this endpoint */
  @ApiProperty({
    type: [EndpointMethod],
    description: 'HTTP methods supported by this endpoint',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EndpointMethod)
  methods: EndpointMethod[];

  /** Descriptive name for the endpoint */
  @ApiPropertyOptional({
    description: 'Descriptive name for the endpoint (e.g., "products-crud")',
  })
  @IsOptional()
  @IsString()
  name?: string;

  /** General description of the endpoint */
  @ApiPropertyOptional({ description: 'General description of the endpoint' })
  @IsOptional()
  @IsString()
  description?: string;
}
