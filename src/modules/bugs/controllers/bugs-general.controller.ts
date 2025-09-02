import {
  Controller,
  Get,
  Query,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { BugsService } from '../services/bugs.service';
import { BugFiltersDto } from '../dto/bug-filters.dto';
import { BugResponseDto } from '../dto/bug-response.dto';

@ApiTags('Bugs General')
@Controller('bugs')
export class BugsGeneralController {
  private readonly logger = new Logger(BugsGeneralController.name);

  constructor(private readonly bugsService: BugsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all bugs with filters (general endpoint)' })
  @ApiResponse({ status: 200, description: 'Bugs retrieved successfully' })
  async getAllBugs(
    @Query() filters: BugFiltersDto,
  ): Promise<{
    bugs: BugResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    this.logger.log('Getting all bugs (general endpoint)');
    return this.bugsService.getAllBugs(filters);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get bug statistics (general endpoint)' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getAllBugStatistics(): Promise<{
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
    bySeverity: { [key: string]: number };
    byType: { [key: string]: number };
    byPriority: { [key: string]: number };
  }> {
    this.logger.log('Getting all bug statistics (general endpoint)');
    return this.bugsService.getAllBugStatistics();
  }

  @Get('failed-executions')
  @ApiOperation({ summary: 'Get all failed executions (general endpoint)' })
  @ApiResponse({ status: 200, description: 'Failed executions retrieved successfully' })
  async getAllFailedExecutions(): Promise<Array<{
    executionId: string;
    testCaseId: string;
    testCaseName: string;
    entityName: string;
    section: string;
    method: string;
    endpoint: string;
    errorMessage: string;
    executionDate: Date;
  }>> {
    this.logger.log('Getting all failed executions (general endpoint)');
    return this.bugsService.getAllFailedExecutions();
  }
}
