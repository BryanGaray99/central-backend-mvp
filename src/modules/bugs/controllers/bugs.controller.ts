import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { BugsService } from '../services/bugs.service';
import { CreateBugDto } from '../dto/create-bug.dto';
import { UpdateBugDto } from '../dto/update-bug.dto';
import { BugFiltersDto } from '../dto/bug-filters.dto';
import { BugResponseDto } from '../dto/bug-response.dto';
import { BugType, BugSeverity, BugPriority, BugStatus } from '../entities/bug.entity';

@ApiTags('Bugs')
@Controller('projects/:projectId/bugs')
export class BugsController {
  private readonly logger = new Logger(BugsController.name);

  constructor(private readonly bugsService: BugsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new bug' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 201, description: 'Bug created successfully', type: BugResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async createBug(
    @Param('projectId') projectId: string,
    @Body() createBugDto: CreateBugDto,
  ): Promise<BugResponseDto> {
    this.logger.log(`Creating bug for project: ${projectId}`);
    return this.bugsService.createBug(projectId, createBugDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all bugs for a project with filters' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Bugs retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getBugs(
    @Param('projectId') projectId: string,
    @Query() filters: BugFiltersDto,
  ): Promise<{
    bugs: BugResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    this.logger.log(`Getting bugs for project: ${projectId}`);
    return this.bugsService.getBugs(projectId, filters);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get bug statistics for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getBugStatistics(
    @Param('projectId') projectId: string,
  ): Promise<{
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
    bySeverity: { [key: string]: number };
    byType: { [key: string]: number };
    byPriority: { [key: string]: number };
  }> {
    this.logger.log(`Getting bug statistics for project: ${projectId}`);
    return this.bugsService.getBugStatistics(projectId);
  }

  @Get('failed-executions')
  @ApiOperation({ summary: 'Get failed executions for creating bugs' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Failed executions retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getFailedExecutions(
    @Param('projectId') projectId: string,
  ): Promise<Array<{
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
    this.logger.log(`Getting failed executions for project: ${projectId}`);
    return this.bugsService.getFailedExecutions(projectId);
  }

  @Post('from-execution')
  @ApiOperation({ summary: 'Create a bug from a failed execution' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 201, description: 'Bug created successfully', type: BugResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Project or test case not found' })
  async createBugFromExecution(
    @Param('projectId') projectId: string,
    @Body() body: {
      executionId: string;
      testCaseId: string;
      title?: string;
      description?: string;
      type?: BugType;
      severity?: BugSeverity;
      priority?: BugPriority;
      errorMessage?: string;
      environment?: string;
    },
  ): Promise<BugResponseDto> {
    this.logger.log(`Creating bug from execution for project: ${projectId}`);
    return this.bugsService.createBugFromFailedExecution(
      projectId,
      body.executionId,
      body.testCaseId,
      {
        title: body.title,
        description: body.description,
        type: body.type,
        severity: body.severity,
        priority: body.priority,
        errorMessage: body.errorMessage,
        environment: body.environment,
      },
    );
  }

  @Get(':bugId')
  @ApiOperation({ summary: 'Get a specific bug' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'bugId', description: 'Bug ID' })
  @ApiResponse({ status: 200, description: 'Bug retrieved successfully', type: BugResponseDto })
  @ApiResponse({ status: 404, description: 'Bug not found' })
  async getBug(
    @Param('projectId') projectId: string,
    @Param('bugId') bugId: string,
  ): Promise<BugResponseDto> {
    this.logger.log(`Getting bug: ${bugId} for project: ${projectId}`);
    return this.bugsService.getBug(projectId, bugId);
  }

  @Put(':bugId')
  @ApiOperation({ summary: 'Update a bug' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'bugId', description: 'Bug ID' })
  @ApiResponse({ status: 200, description: 'Bug updated successfully', type: BugResponseDto })
  @ApiResponse({ status: 404, description: 'Bug not found' })
  async updateBug(
    @Param('projectId') projectId: string,
    @Param('bugId') bugId: string,
    @Body() updateBugDto: UpdateBugDto,
  ): Promise<BugResponseDto> {
    this.logger.log(`Updating bug: ${bugId} for project: ${projectId}`);
    return this.bugsService.updateBug(projectId, bugId, updateBugDto);
  }

  @Delete(':bugId')
  @ApiOperation({ summary: 'Delete a bug' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'bugId', description: 'Bug ID' })
  @ApiResponse({ status: 200, description: 'Bug deleted successfully' })
  @ApiResponse({ status: 404, description: 'Bug not found' })
  async deleteBug(
    @Param('projectId') projectId: string,
    @Param('bugId') bugId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Deleting bug: ${bugId} for project: ${projectId}`);
    return this.bugsService.deleteBug(projectId, bugId);
  }

  @Get('types')
  @ApiOperation({ summary: 'Get available bug types' })
  @ApiResponse({ status: 200, description: 'Bug types retrieved successfully' })
  async getBugTypes(): Promise<{ [key: string]: string }> {
    return {
      [BugType.SYSTEM_BUG]: 'System Bug',
      [BugType.FRAMEWORK_ERROR]: 'Framework Error',
      [BugType.TEST_FAILURE]: 'Test Failure',
      [BugType.ENVIRONMENT_ISSUE]: 'Environment Issue',
    };
  }

  @Get('severities')
  @ApiOperation({ summary: 'Get available bug severities' })
  @ApiResponse({ status: 200, description: 'Bug severities retrieved successfully' })
  async getBugSeverities(): Promise<{ [key: string]: string }> {
    return {
      [BugSeverity.LOW]: 'Low',
      [BugSeverity.MEDIUM]: 'Medium',
      [BugSeverity.HIGH]: 'High',
      [BugSeverity.CRITICAL]: 'Critical',
    };
  }

  @Get('priorities')
  @ApiOperation({ summary: 'Get available bug priorities' })
  @ApiResponse({ status: 200, description: 'Bug priorities retrieved successfully' })
  async getBugPriorities(): Promise<{ [key: string]: string }> {
    return {
      [BugPriority.LOW]: 'Low',
      [BugPriority.MEDIUM]: 'Medium',
      [BugPriority.HIGH]: 'High',
      [BugPriority.CRITICAL]: 'Critical',
    };
  }

  @Get('statuses')
  @ApiOperation({ summary: 'Get available bug statuses' })
  @ApiResponse({ status: 200, description: 'Bug statuses retrieved successfully' })
  async getBugStatuses(): Promise<{ [key: string]: string }> {
    return {
      [BugStatus.OPEN]: 'Open',
      [BugStatus.IN_PROGRESS]: 'In Progress',
      [BugStatus.RESOLVED]: 'Resolved',
      [BugStatus.CLOSED]: 'Closed',
    };
  }
}
