import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  HttpCode,
  HttpStatus,
  Delete,
  ConflictException,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Project } from './project.entity';
import { ApiTags, ApiResponse, ApiOperation } from '@nestjs/swagger';
import { CustomApiResponse } from '../../common/interfaces/api-response.interface';

/**
 * Controller for managing testing projects.
 * 
 * This controller provides REST API endpoints for creating, reading, updating,
 * and deleting testing projects. It handles project lifecycle management and
 * integrates with workspace creation and project generation services.
 * 
 * @class ProjectsController
 * @since 1.0.0
 */
@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  /**
   * Creates an instance of ProjectsController.
   * 
   * @param projectsService - The projects service for business logic
   */
  constructor(private readonly projectsService: ProjectsService) {}

  /**
   * Creates a new testing project.
   * 
   * This endpoint creates a new project with the specified configuration,
   * including workspace creation and project generation.
   * 
   * @param dto - Project creation data
   * @returns Promise that resolves to the created project
   * @throws {ConflictException} When project name already exists
   * 
   * @example
   * ```typescript
   * const project = await projectsController.create({
   *   name: 'my-test-project',
   *   baseUrl: 'http://localhost:3000',
   *   displayName: 'My Test Project'
   * });
   * ```
   */
  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({ status: 201, description: 'Project created', type: Project })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Project already exists or resources are locked',
  })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateProjectDto): Promise<Project> {
    return this.projectsService.create(dto);
  }

  /**
   * Retrieves all projects.
   * 
   * @returns Promise that resolves to an array of all projects
   * 
   * @example
   * ```typescript
   * const projects = await projectsController.findAll();
   * console.log(`Found ${projects.length} projects`);
   * ```
   */
  @Get()
  @ApiOperation({ summary: 'List all projects' })
  @ApiResponse({
    status: 200,
    description: 'List of projects',
    type: [Project],
  })
  async findAll(): Promise<Project[]> {
    return this.projectsService.findAll();
  }

  /**
   * Retrieves a project by its ID.
   * 
   * @param id - The unique identifier of the project
   * @returns Promise that resolves to the project
   * @throws {NotFoundException} When project is not found
   * 
   * @example
   * ```typescript
   * const project = await projectsController.findOne('project-uuid');
   * console.log(`Project: ${project.name}`);
   * ```
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a project by ID' })
  @ApiResponse({ status: 200, description: 'Project found', type: Project })
  async findOne(@Param('id') id: string): Promise<Project> {
    return this.projectsService.findOne(id);
  }

  /**
   * Updates an existing project.
   * 
   * @param id - The unique identifier of the project to update
   * @param dto - Project update data
   * @returns Promise that resolves to the updated project
   * @throws {NotFoundException} When project is not found
   * @throws {ConflictException} When resources are locked
   * 
   * @example
   * ```typescript
   * const updatedProject = await projectsController.update('project-uuid', {
   *   displayName: 'Updated Project Name',
   *   baseUrl: 'http://new-url:3000'
   * });
   * ```
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update a project' })
  @ApiResponse({ status: 200, description: 'Project updated', type: Project })
  @ApiResponse({ status: 409, description: 'Conflict - Resources are locked' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<Project> {
    return this.projectsService.update(id, dto);
  }

  /**
   * Deletes a project by its ID.
   * 
   * This endpoint removes the project from the database and cleans up
   * associated workspace files.
   * 
   * @param id - The unique identifier of the project to delete
   * @returns Promise that resolves to a custom API response
   * @throws {NotFoundException} When project is not found
   * @throws {ConflictException} When resources are locked or files are in use
   * 
   * @example
   * ```typescript
   * const result = await projectsController.remove('project-uuid');
   * console.log(result.message); // 'Project with ID project-uuid deleted successfully'
   * ```
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a project by ID' })
  @ApiResponse({ status: 200, description: 'Project deleted successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Resources are locked',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: {
          type: 'object',
          properties: {
            statusCode: { type: 'number', example: 409 },
            message: {
              type: 'string',
              example:
                'Cannot delete workspace because there are files in use.',
            },
            code: { type: 'string', example: 'RESOURCE_BUSY' },
            details: {
              type: 'object',
              properties: {
                workspace: { type: 'string' },
                blockedFiles: { type: 'array', items: { type: 'string' } },
                suggestion: { type: 'string' },
              },
            },
          },
        },
      },
    },
  })
  async remove(@Param('id') id: string): Promise<CustomApiResponse> {
    await this.projectsService.remove(id);
    return {
      success: true,
      data: null,
      message: `Project with ID ${id} deleted successfully`,
    };
  }
}
