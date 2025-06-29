import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class UpdateEndpointDto {
  @ApiPropertyOptional({
    description: 'New entity name for the endpoint',
    example: 'Product',
  })
  @IsString()
  @IsOptional()
  entityName?: string;

  @ApiPropertyOptional({
    description: 'New section to organize the endpoint',
    example: 'ecommerce',
  })
  @IsString()
  @IsOptional()
  section?: string;

  @ApiPropertyOptional({
    description: 'New description for the endpoint',
    example: 'CRUD operations for products',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
