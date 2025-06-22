import { Controller, Post, Get, Patch, Delete, Body, Param, Query, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiPropertyOptional } from '@nestjs/swagger';
import { EndpointsService } from './endpoints.service';
import { RegisterEndpointDto } from './dto/register-endpoint.dto';
import { UpdateEndpointDto } from './dto/update-endpoint.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Project } from '../projects/project.entity';
import { Repository } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs/promises';

@ApiTags('Endpoints')
@Controller('endpoints')
export class EndpointsController {
  constructor(
    private readonly endpointsService: EndpointsService,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  @Post('register-and-analyze')
  @ApiOperation({ summary: 'Analyzes an endpoint and generates its testing artifacts' })
  async registerAndAnalyze(@Body() dto: RegisterEndpointDto) {
    return this.endpointsService.registerAndAnalyze(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lists registered endpoints for a project' })
  async getEndpoints(@Query('projectId') projectId: string) {
    if (!projectId) {
      throw new NotFoundException('projectId is required');
    }
    
    // Get project from database to obtain its real path
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }
    
    const metaPath = path.join(project.path, 'project-meta.json');
    
    try {
      const metaContent = await fs.readFile(metaPath, 'utf-8');
      const meta = JSON.parse(metaContent);
      
      return {
        success: true,
        data: meta.endpoints || []
      };
    } catch (error) {
      throw new NotFoundException(`Could not read project-meta.json for project ${projectId}`);
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Gets details of a specific endpoint' })
  async getEndpointById(@Param('id') id: string, @Query('projectId') projectId: string) {
    if (!projectId) {
      throw new NotFoundException('projectId is required');
    }
    
    // Get project from database to obtain its real path
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }
    
    const metaPath = path.join(project.path, 'project-meta.json');
    
    try {
      const metaContent = await fs.readFile(metaPath, 'utf-8');
      const meta = JSON.parse(metaContent);
      
      const endpoint = meta.endpoints?.find((ep: any) => ep.id === id);
      if (!endpoint) {
        throw new NotFoundException(`Endpoint with ID ${id} not found`);
      }
      
      return {
        success: true,
        data: endpoint
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException(`Could not read project-meta.json for project ${projectId}`);
    }
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Updates endpoint metadata' })
  async updateEndpoint(@Param('id') id: string, @Query('projectId') projectId: string, @Body() updateData: UpdateEndpointDto) {
    if (!projectId) {
      throw new NotFoundException('projectId is required');
    }
    
    // Get project from database
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }
    
    const metaPath = path.join(project.path, 'project-meta.json');
    
    try {
      const metaContent = await fs.readFile(metaPath, 'utf-8');
      const meta = JSON.parse(metaContent);
      
      const endpointIndex = meta.endpoints?.findIndex((ep: any) => ep.id === id);
      if (endpointIndex === -1 || endpointIndex === undefined) {
        throw new NotFoundException(`Endpoint with ID ${id} not found`);
      }
      
      const endpoint = meta.endpoints[endpointIndex];
      
      // Update allowed fields
      if (updateData.entityName) {
        endpoint.entityName = updateData.entityName;
      }
      if (updateData.section) {
        endpoint.section = updateData.section;
      }
      
      // Update timestamp
      endpoint.lastAnalysis.timestamp = new Date().toISOString();
      
      // Write updated meta
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
      
      return {
        success: true,
        data: endpoint
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Error updating endpoint: ${error.message}`);
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deletes an endpoint and its associated artifacts' })
  async deleteEndpoint(@Param('id') id: string, @Query('projectId') projectId: string) {
    if (!projectId) {
      throw new NotFoundException('projectId is required');
    }
    
    // Get project from database
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }
    
    const metaPath = path.join(project.path, 'project-meta.json');
    
    try {
      const metaContent = await fs.readFile(metaPath, 'utf-8');
      const meta = JSON.parse(metaContent);
      
      const endpointIndex = meta.endpoints?.findIndex((ep: any) => ep.id === id);
      if (endpointIndex === -1 || endpointIndex === undefined) {
        throw new NotFoundException(`Endpoint with ID ${id} not found`);
      }
      
      const endpoint = meta.endpoints[endpointIndex];
      
      // Delete artifact files
      await this.deleteArtifactFiles(project.path, endpoint.generatedArtifacts);
      
      // Remove endpoint from meta
      meta.endpoints.splice(endpointIndex, 1);
      
      // Write updated meta
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
      
      return {
        success: true,
        message: `Endpoint and associated artifacts deleted successfully.`
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Error deleting endpoint: ${error.message}`);
    }
  }

  private async deleteArtifactFiles(projectPath: string, artifacts: any): Promise<void> {
    const filesToDelete = [
      artifacts.feature,
      artifacts.steps,
      artifacts.fixture,
      artifacts.schema,
      artifacts.types
    ];
    
    for (const file of filesToDelete) {
      if (file) {
        const filePath = path.join(projectPath, file);
        try {
          await fs.unlink(filePath);
        } catch (error: any) {
          if (error.code !== 'ENOENT') {
            console.warn(`Could not delete ${filePath}: ${error.message}`);
          }
        }
      }
    }
  }
} 