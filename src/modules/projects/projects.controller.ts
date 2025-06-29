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

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

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

  @Get(':id')
  @ApiOperation({ summary: 'Get a project by ID' })
  @ApiResponse({ status: 200, description: 'Project found', type: Project })
  async findOne(@Param('id') id: string): Promise<Project> {
    return this.projectsService.findOne(id);
  }

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
