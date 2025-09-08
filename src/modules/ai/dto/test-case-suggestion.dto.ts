import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

/**
 * DTO for test case suggestion requests.
 * Contains the parameters needed to generate AI-powered test case suggestions.
 */
export class TestCaseSuggestionRequestDto {
  @ApiProperty({
    description: 'Section of the API (e.g., ecommerce, auth, user)',
    example: 'ecommerce'
  })
  @IsString()
  @IsNotEmpty()
  section: string;

  @ApiProperty({
    description: 'Entity name for the test cases (e.g., Product, User, Order)',
    example: 'Product'
  })
  @IsString()
  @IsNotEmpty()
  entityName: string;

  @ApiProperty({
    description: 'Natural language description of what test cases the user expects',
    example: 'Test cases for product creation, validation, and error handling scenarios'
  })
  @IsString()
  @IsNotEmpty()
  requirements: string;
}

/**
 * DTO representing a single test case suggestion.
 * Contains the structured information for a suggested test case.
 */
export class TestCaseSuggestionDto {
  @ApiProperty({
    description: 'Short prompt describing the test case',
    example: 'Create product with valid data'
  })
  @IsString()
  shortPrompt: string;

  @ApiProperty({
    description: 'Brief description of the test case',
    example: 'Verify successful product creation with valid input data'
  })
  @IsString()
  shortDescription: string;

  @ApiProperty({
    description: 'Detailed description explaining the test case purpose and coverage',
    example: 'This test case validates that the API correctly creates a product when all required fields are provided with valid data. It ensures the response contains the created product details and appropriate status codes.'
  })
  @IsString()
  detailedDescription: string;
}

/**
 * DTO for test case suggestion responses.
 * Contains the generated suggestions and metadata about the generation process.
 */
export class TestCaseSuggestionResponseDto {
  @ApiProperty({
    description: 'List of test case suggestions',
    type: [TestCaseSuggestionDto]
  })
  suggestions: TestCaseSuggestionDto[];

  @ApiProperty({
    description: 'Total number of suggestions generated',
    example: 5
  })
  totalSuggestions: number;

  @ApiProperty({
    description: 'Message indicating the success of the operation',
    example: 'Test case suggestions generated successfully'
  })
  message: string;
}
