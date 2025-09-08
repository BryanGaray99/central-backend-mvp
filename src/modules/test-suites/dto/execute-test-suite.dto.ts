import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsNumber, IsEnum } from 'class-validator';
import { TestType, TestEnvironment } from '../../test-execution/dto/execute-tests.dto';

export class ExecuteTestSuiteDto {
  @ApiPropertyOptional({
    description: 'Specific HTTP method to filter test cases',
    example: 'POST',
  })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({
    description: 'Type of tests to execute',
    enum: TestType,
    default: TestType.ALL,
  })
  @IsOptional()
  @IsEnum(TestType)
  testType?: TestType = TestType.ALL;

  @ApiPropertyOptional({
    description: 'Run tests in parallel',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  parallel?: boolean = true;

  @ApiPropertyOptional({
    description: 'Timeout in milliseconds for each test',
    minimum: 1000,
    maximum: 300000,
    default: 30000,
  })
  @IsOptional()
  @IsNumber()
  timeout?: number = 30000;

  @ApiPropertyOptional({
    description: 'Number of retries on failure',
    minimum: 0,
    maximum: 5,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  retries?: number = 1;

  @ApiPropertyOptional({
    description: 'Target test environment',
    enum: TestEnvironment,
    default: TestEnvironment.LOCAL,
  })
  @IsOptional()
  @IsEnum(TestEnvironment)
  environment?: TestEnvironment = TestEnvironment.LOCAL;

  @ApiPropertyOptional({
    description: 'Show verbose logs',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  verbose?: boolean = true;

  @ApiPropertyOptional({
    description: 'Persist request/response logs',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  saveLogs?: boolean = true;

  @ApiPropertyOptional({
    description: 'Persist request/response payloads',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  savePayloads?: boolean = true;

  @ApiPropertyOptional({
    description: 'Number of workers for parallel execution',
    minimum: 1,
    maximum: 10,
    default: 3,
  })
  @IsOptional()
  @IsNumber()
  workers?: number = 3;
}
