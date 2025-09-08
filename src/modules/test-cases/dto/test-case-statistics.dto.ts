import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for pagination information.
 *
 * This DTO defines the structure of pagination data in API responses.
 * It includes page number, limit, total count, and total pages.
 *
 * @class PaginationDto
 * @since 1.0.0
 */
export class PaginationDto {
  /**
   * Current page number.
   *
   * @example 1
   */
  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  /**
   * Limit of results per page.
   *
   * @example 20
   */
  @ApiProperty({
    description: 'Limit of results per page',
    example: 20,
  })
  limit: number;

  /**
   * Total number of results.
   *
   * @example 100
   */
  @ApiProperty({
    description: 'Total number of results',
    example: 100,
  })
  total: number;

  /**
   * Total number of pages.
   *
   * @example 5
   */
  @ApiProperty({
    description: 'Total number of pages',
    example: 5,
  })
  totalPages: number;
}

/**
 * Data Transfer Object for test case list response.
 *
 * This DTO defines the structure of test case list responses including
 * the test cases array, pagination information, and applied filters.
 *
 * @class TestCaseListResponseDto
 * @since 1.0.0
 */
export class TestCaseListResponseDto {
  /**
   * Array of test cases.
   */
  @ApiProperty({
    description: 'Array of test cases',
    type: 'array',
    items: { $ref: '#/components/schemas/TestCaseResponseDto' },
  })
  testCases: any[];

  /**
   * Pagination information.
   */
  @ApiProperty({
    description: 'Pagination information',
    type: PaginationDto,
  })
  pagination: PaginationDto;

  /**
   * Applied filters.
   */
  @ApiProperty({
    description: 'Applied filters',
    type: 'object',
    additionalProperties: true,
  })
  filters: any;
}

/**
 * Data Transfer Object for test case statistics.
 *
 * This DTO defines the structure of test case statistics in API responses.
 * It includes counts by type, status, and performance metrics.
 *
 * @class TestCaseStatisticsDto
 * @since 1.0.0
 */
export class TestCaseStatisticsDto {
  /**
   * Total number of test cases.
   *
   * @example 100
   */
  @ApiProperty({
    description: 'Total number of test cases',
    example: 100,
  })
  totalCases: number;

  /**
   * Number of positive test cases.
   *
   * @example 60
   */
  @ApiProperty({
    description: 'Number of positive test cases',
    example: 60,
  })
  positiveCases: number;

  /**
   * Number of negative test cases.
   *
   * @example 30
   */
  @ApiProperty({
    description: 'Number of negative test cases',
    example: 30,
  })
  negativeCases: number;

  /**
   * Number of edge case test cases.
   *
   * @example 10
   */
  @ApiProperty({
    description: 'Number of edge case test cases',
    example: 10,
  })
  edgeCases: number;

  /**
   * Number of active test cases.
   *
   * @example 80
   */
  @ApiProperty({
    description: 'Number of active test cases',
    example: 80,
  })
  activeCases: number;

  /**
   * Number of draft test cases.
   *
   * @example 15
   */
  @ApiProperty({
    description: 'Number of draft test cases',
    example: 15,
  })
  draftCases: number;

  /**
   * Number of deprecated test cases.
   *
   * @example 5
   */
  @ApiProperty({
    description: 'Number of deprecated test cases',
    example: 5,
  })
  deprecatedCases: number;

  /**
   * Average duration in milliseconds.
   *
   * @example 1500
   */
  @ApiProperty({
    description: 'Average duration in milliseconds',
    example: 1500,
  })
  averageDuration: number;

  /**
   * Last update timestamp.
   *
   * @example '2024-01-01T00:00:00Z'
   */
  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-01T00:00:00Z',
  })
  lastUpdated: Date;
}
