import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RegisterEndpointDto } from './dto/register-endpoint.dto';
import { AnalysisService } from './services/analysis.service';
import { ArtifactsGenerationService } from './services/artifacts-generation.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Project } from '../projects/project.entity';
import { Repository } from 'typeorm';
import { FileSystemService } from '../projects/services/file-system.service';
import * as path from 'path';
import * as fs from 'fs/promises';

@Injectable()
export class EndpointsService {
  private readonly logger = new Logger(EndpointsService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly analysisService: AnalysisService,
    private readonly artifactsGenerationService: ArtifactsGenerationService,
    private readonly fileSystemService: FileSystemService,
  ) {}

  async registerAndAnalyze(dto: RegisterEndpointDto) {
    this.logger.log(`Starting analysis for project ${dto.projectId}`);
    
    // 1. Get project data (like baseUrl)
    const project = await this.projectRepository.findOneBy({ id: dto.projectId });
    if (!project) {
      throw new NotFoundException(`Project with ID ${dto.projectId} not found.`);
    }

    // 2. Call analysis service
    const analysisResult = await this.analysisService.analyze(project, dto);

    // 3. Call artifacts generation service
    await this.artifactsGenerationService.generate(project, dto, analysisResult);

    // 4. Update project-meta.json
    await this.updateProjectMeta(project, dto, analysisResult);

    this.logger.log(`Process completed for ${dto.projectId}.`);
    return { 
      success: true,
      data: {
        projectId: dto.projectId,
        message: `Analysis and generation for endpoint '${dto.method} ${dto.path}' completed successfully.`,
        analysisResult,
      }
    };
  }

  private async updateProjectMeta(project: Project, dto: RegisterEndpointDto, analysisResult: any) {
    const metaPath = path.join(project.path, 'project-meta.json');
    
    try {
      // Read current meta
      const metaContent = await fs.readFile(metaPath, 'utf-8');
      const meta = JSON.parse(metaContent);
      
      // Create unique endpoint ID
      const endpointId = `${dto.method}:${dto.path}`;
      
      // Add new endpoint
      const newEndpoint = {
        id: endpointId,
        entityName: dto.entityName,
        path: dto.path,
        method: dto.method,
        section: dto.section,
        generatedArtifacts: {
          feature: `src/features/${dto.section}/${dto.entityName.toLowerCase()}.feature`,
          steps: `src/steps/${dto.section}/${dto.entityName.toLowerCase()}.steps.ts`,
          fixture: `src/fixtures/${dto.section}/${dto.entityName.toLowerCase()}.fixture.ts`,
          schema: `src/schemas/${dto.section}/${dto.entityName.toLowerCase()}.schema.ts`,
          types: `src/types/${dto.section}/${dto.entityName.toLowerCase()}.ts`
        },
        lastAnalysis: {
          timestamp: new Date().toISOString(),
          inferredStatusCode: analysisResult.inferredStatusCode,
          inferredDataPath: analysisResult.inferredDataPath
        }
      };
      
      // Initialize array if it doesn't exist
      if (!meta.endpoints) {
        meta.endpoints = [];
      }
      
      // Add endpoint (or update if it already exists)
      const existingIndex = meta.endpoints.findIndex((ep: any) => ep.id === endpointId);
      if (existingIndex >= 0) {
        meta.endpoints[existingIndex] = newEndpoint;
      } else {
        meta.endpoints.push(newEndpoint);
      }
      
      // Write updated meta
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
      this.logger.log(`project-meta.json updated for endpoint ${endpointId}`);
      
    } catch (error) {
      this.logger.error(`Error updating project-meta.json: ${error.message}`);
      // Don't throw error to avoid failing the entire process
    }
  }
} 