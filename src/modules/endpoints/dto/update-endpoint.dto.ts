import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

/**
 * Data Transfer Object for updating an existing endpoint.
 * 
 * This DTO defines the structure and validation rules for endpoint update requests.
 * All fields are optional, allowing partial updates of endpoint metadata.
 * 
 * @class UpdateEndpointDto
 * @since 1.0.0
 */
export class UpdateEndpointDto {
  /**
   * New entity name for the endpoint.
   * 
   * @example 'Product'
   */
  @ApiPropertyOptional({
    description: 'New entity name for the endpoint',
    example: 'Product',
  })
  @IsString()
  @IsOptional()
  entityName?: string;

  /**
   * New section to organize the endpoint.
   * 
   * @example 'ecommerce'
   */
  @ApiPropertyOptional({
    description: 'New section to organize the endpoint',
    example: 'ecommerce',
  })
  @IsString()
  @IsOptional()
  section?: string;

  /**
   * New description for the endpoint.
   * 
   * @example 'CRUD operations for products'
   */
  @ApiPropertyOptional({
    description: 'New description for the endpoint',
    example: 'CRUD operations for products',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
