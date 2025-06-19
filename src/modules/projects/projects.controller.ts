import { Controller, Post, Body, Get, Patch, Param, HttpCode, HttpStatus, Delete, ConflictException } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Crear un nuevo proyecto' })
  @ApiResponse({ status: 201, description: 'Proyecto creado', type: Project })
  @ApiResponse({ status: 409, description: 'Conflicto - Proyecto ya existe o recursos bloqueados' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateProjectDto): Promise<Project> {
    return this.projectsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los proyectos' })
  @ApiResponse({ status: 200, description: 'Lista de proyectos', type: [Project] })
  async findAll(): Promise<Project[]> {
    return this.projectsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un proyecto por ID' })
  @ApiResponse({ status: 200, description: 'Proyecto encontrado', type: Project })
  async findOne(@Param('id') id: string): Promise<Project> {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un proyecto' })
  @ApiResponse({ status: 200, description: 'Proyecto actualizado', type: Project })
  @ApiResponse({ status: 409, description: 'Conflicto - Recursos bloqueados' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<Project> {
    return this.projectsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un proyecto por ID' })
  @ApiResponse({ status: 200, description: 'Proyecto eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Proyecto no encontrado' })
  @ApiResponse({ status: 409, description: 'Conflicto - Recursos bloqueados', schema: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      error: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 409 },
          message: { type: 'string', example: 'No se puede eliminar el workspace porque hay archivos en uso.' },
          code: { type: 'string', example: 'RESOURCE_BUSY' },
          details: {
            type: 'object',
            properties: {
              workspace: { type: 'string' },
              blockedFiles: { type: 'array', items: { type: 'string' } },
              suggestion: { type: 'string' }
            }
          }
        }
      }
    }
  }})
  async remove(@Param('id') id: string): Promise<CustomApiResponse> {
    await this.projectsService.remove(id);
    return {
      success: true,
      data: null,
      message: `Proyecto con ID ${id} eliminado exitosamente`
    };
  }
} 