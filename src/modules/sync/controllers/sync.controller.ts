import { Controller, Post, Param, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SyncService } from '../services/sync.service';
import { SyncResponseDto } from '../dto/sync-response.dto';

/**
 * Sync Controller
 * 
 * Handles HTTP requests for project synchronization operations.
 * Provides endpoints for full project sync, endpoints-only sync,
 * and test cases-only sync to maintain consistency between
 * file system artifacts and database entities.
 * 
 * @controller SyncController
 */
@ApiTags('Sync')
@Controller('sync')
export class SyncController {
  private readonly logger = new Logger(SyncController.name);

  constructor(private readonly syncService: SyncService) {}

  /**
   * Synchronizes the complete project including endpoints, test cases, and steps.
   * 
   * @param projectId - The project ID to synchronize
   * @returns Promise<SyncResponseDto> - Synchronization result with detailed statistics
   * @throws NotFoundException - If project not found
   * 
   * @example
   * ```typescript
   * const result = await syncController.syncProject('project-123');
   * console.log(`Sync completed: ${result.data.endpointsUpdated} endpoints, ${result.data.testCasesSynced} test cases`);
   * ```
   */
  @Post('projects/:projectId')
  @ApiOperation({
    summary: 'Synchronize complete project',
    description: 'Synchronizes all project files with the database: endpoints, test cases and steps'
  })
  @ApiResponse({
    status: 200,
    description: 'Project synchronized successfully',
    type: SyncResponseDto
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  async syncProject(@Param('projectId') projectId: string) {
    this.logger.log(`Starting project synchronization: ${projectId}`);
    
    try {
      const result = await this.syncService.syncProject(projectId);
      this.logger.log(`Project synchronization completed: ${projectId}`);
      return result;
    } catch (error) {
      this.logger.error(`Error synchronizing project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Synchronizes only the endpoints of the project.
   * 
   * @param projectId - The project ID to synchronize endpoints for
   * @returns Promise<object> - Endpoints synchronization result
   * @throws NotFoundException - If project not found
   * 
   * @example
   * ```typescript
   * const result = await syncController.syncEndpoints('project-123');
   * console.log(`Endpoints synchronized: ${result.endpointsUpdated}`);
   * ```
   */
  @Post('projects/:projectId/endpoints')
  @ApiOperation({
    summary: 'Synchronize endpoints only',
    description: 'Synchronizes only the project endpoints'
  })
  async syncEndpoints(@Param('projectId') projectId: string) {
    this.logger.log(`Synchronizing project endpoints: ${projectId}`);
    
    try {
      const result = await this.syncService.syncEndpoints(projectId);
      this.logger.log(`Endpoints synchronized for project: ${projectId}`);
      return result;
    } catch (error) {
      this.logger.error(`Error synchronizing project endpoints ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Synchronizes only the test cases of the project.
   * 
   * @param projectId - The project ID to synchronize test cases for
   * @returns Promise<object> - Test cases synchronization result
   * @throws NotFoundException - If project not found
   * 
   * @example
   * ```typescript
   * const result = await syncController.syncTestCases('project-123');
   * console.log(`Test cases synchronized: ${result.testCasesSynced}`);
   * ```
   */
  @Post('projects/:projectId/test-cases')
  @ApiOperation({
    summary: 'Synchronize test cases only',
    description: 'Synchronizes only the project test cases'
  })
  async syncTestCases(@Param('projectId') projectId: string) {
    this.logger.log(`Synchronizing project test cases: ${projectId}`);
    
    try {
      const result = await this.syncService.syncTestCases(projectId);
      this.logger.log(`Test cases synchronized for project: ${projectId}`);
      return result;
    } catch (error) {
      this.logger.error(`Error synchronizing project test cases ${projectId}:`, error);
      throw error;
    }
  }
}
