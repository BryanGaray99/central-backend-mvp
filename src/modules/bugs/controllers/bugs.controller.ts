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

/**
 * Bugs Controller
 * 
 * Handles bug management operations within specific projects.
 * Provides endpoints for creating, reading, updating, and deleting bugs,
 * as well as creating bugs from failed test executions and retrieving statistics.
 * 
 * @controller BugsController
 */
@ApiTags('Bugs')
@Controller('projects/:projectId/bugs')
export class BugsController {
  private readonly logger = new Logger(BugsController.name);

  constructor(private readonly bugsService: BugsService) {}

  /**
   * Creates a new bug for a specific project.
   * 
   * @param projectId - The project ID
   * @param createBugDto - The bug creation data
   * @returns Promise<BugResponseDto> - The created bug
   * @throws 400 - Bad request
   * @throws 404 - Project not found
   * 
   * @example
   * ```typescript
   * const bug = await bugsController.createBug('project-123', {
   *   title: 'API returns 500 error',
   *   description: 'Product creation fails with internal server error',
   *   type: BugType.TEST_FAILURE,
   *   severity: BugSeverity.HIGH
   * });
   * ```
   */
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

  /**
   * Gets all bugs for a specific project with optional filters.
   * 
   * @param projectId - The project ID
   * @param filters - Optional filters for bug retrieval
   * @returns Promise<object> - Paginated list of bugs with metadata
   * @throws 404 - Project not found
   * 
   * @example
   * ```typescript
   * const result = await bugsController.getBugs('project-123', {
   *   severity: 'high',
   *   status: 'open',
   *   page: 1,
   *   limit: 10
   * });
   * console.log(`Found ${result.total} bugs in project`);
   * ```
   */
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

  /**
   * Gets bug statistics for a specific project.
   * 
   * @param projectId - The project ID
   * @returns Promise<object> - Statistics object with counts by status, severity, type, and priority
   * @throws 404 - Project not found
   * 
   * @example
   * ```typescript
   * const stats = await bugsController.getBugStatistics('project-123');
   * console.log(`Project has ${stats.total} bugs, ${stats.open} open`);
   * ```
   */
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

  /**
   * Gets failed test executions for a specific project for bug creation.
   * 
   * @param projectId - The project ID
   * @returns Promise<Array<object>> - Array of failed execution details
   * @throws 404 - Project not found
   * 
   * @example
   * ```typescript
   * const failedExecutions = await bugsController.getFailedExecutions('project-123');
   * console.log(`Found ${failedExecutions.length} failed executions in project`);
   * ```
   */
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

  /**
   * Creates a bug from a failed test execution.
   * 
   * @param projectId - The project ID
   * @param body - The bug creation data from execution
   * @returns Promise<BugResponseDto> - The created bug
   * @throws 400 - Bad request
   * @throws 404 - Project or test case not found
   * 
   * @example
   * ```typescript
   * const bug = await bugsController.createBugFromExecution('project-123', {
   *   executionId: 'exec-456',
   *   testCaseId: 'TC-ECOMMERCE-01',
   *   title: 'Custom bug title',
   *   severity: BugSeverity.HIGH
   * });
   * ```
   */
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

  /**
   * Gets a specific bug by its ID.
   * 
   * @param projectId - The project ID
   * @param bugId - The bug ID
   * @returns Promise<BugResponseDto> - The bug details
   * @throws 404 - Bug not found
   * 
   * @example
   * ```typescript
   * const bug = await bugsController.getBug('project-123', 'BUG-ECOMMERCE-001');
   * console.log(`Bug title: ${bug.title}`);
   * ```
   */
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

  /**
   * Updates an existing bug.
   * 
   * @param projectId - The project ID
   * @param bugId - The bug ID
   * @param updateBugDto - The bug update data
   * @returns Promise<BugResponseDto> - The updated bug
   * @throws 404 - Bug not found
   * 
   * @example
   * ```typescript
   * const updatedBug = await bugsController.updateBug('project-123', 'BUG-ECOMMERCE-001', {
   *   status: BugStatus.IN_PROGRESS,
   *   priority: BugPriority.HIGH
   * });
   * ```
   */
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

  /**
   * Deletes a bug.
   * 
   * @param projectId - The project ID
   * @param bugId - The bug ID
   * @returns Promise<{ success: boolean; message: string }> - Deletion result
   * @throws 404 - Bug not found
   * 
   * @example
   * ```typescript
   * const result = await bugsController.deleteBug('project-123', 'BUG-ECOMMERCE-001');
   * console.log(result.message); // "Bug BUG-ECOMMERCE-001 deleted successfully"
   * ```
   */
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

}
