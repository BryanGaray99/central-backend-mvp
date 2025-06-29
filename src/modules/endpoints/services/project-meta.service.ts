import { Injectable, Logger } from '@nestjs/common';
import { FileSystemService } from '../../projects/services/file-system.service';
import { Project } from '../../projects/project.entity';
import { RegisterEndpointDto } from '../dto/register-endpoint.dto';
import * as path from 'path';

@Injectable()
export class ProjectMetaService {
  private readonly logger = new Logger(ProjectMetaService.name);

  constructor(
    private readonly fileSystemService: FileSystemService,
  ) {}

  async updateProjectMeta(
    project: Project,
    dto: RegisterEndpointDto,
    analysisResult: any,
  ) {
    try {
      const projectMetaPath = path.join(project.path, 'project-meta.json');

      // Read existing project meta
      let projectMeta;
      try {
        const metaContent =
          await this.fileSystemService.readFile(projectMetaPath);
        projectMeta = JSON.parse(metaContent);
      } catch (error) {
        // If file doesn't exist, create basic structure
        projectMeta = {
          id: project.id,
          name: project.name,
          status: 'ready-with-content',
          endpoints: [],
        };
      }

      // Add new endpoint to metadata
      const endpointId = `${dto.methods[0]?.method || 'GET'}:${dto.path}`;
      const newEndpoint = {
        entityName: dto.entityName,
        path: dto.path,
        method: dto.methods[0]?.method || 'GET',
        section: dto.section,
        generatedArtifacts: {
          feature: `src/features/${dto.section}/${dto.entityName.toLowerCase()}.feature`,
          steps: `src/steps/${dto.section}/${dto.entityName.toLowerCase()}.steps.ts`,
          fixture: `src/fixtures/${dto.section}/${dto.entityName.toLowerCase()}.fixture.ts`,
          schema: `src/schemas/${dto.section}/${dto.entityName.toLowerCase()}.schema.ts`,
          types: `src/types/${dto.section}/${dto.entityName.toLowerCase()}.ts`,
          client: `src/api/${dto.section}/${dto.entityName.toLowerCase()}.client.ts`,
        },
        lastAnalysis: {
          timestamp: new Date().toISOString(),
          inferredStatusCode:
            analysisResult.analysisResults?.[dto.methods[0]?.method || 'GET']
              ?.statusCode || 200,
          inferredDataPath:
            analysisResult.analysisResults?.[dto.methods[0]?.method || 'GET']
              ?.dataPath || 'data',
        },
      };

      // Check if endpoint already exists and update it, otherwise add it
      const existingIndex = projectMeta.endpoints.findIndex(
        (ep: any) => ep.entityName === dto.entityName && ep.path === dto.path,
      );

      if (existingIndex >= 0) {
        projectMeta.endpoints[existingIndex] = newEndpoint;
      } else {
        projectMeta.endpoints.push(newEndpoint);
      }

      // Write updated project meta
      await this.fileSystemService.writeFile(
        projectMetaPath,
        JSON.stringify(projectMeta, null, 2),
      );

      console.log('📝 Project meta updated successfully');
    } catch (error) {
      console.error('❌ Error updating project meta:', error);
      // Don't throw error to avoid failing the entire generation
    }
  }
} 