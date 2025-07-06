import { Injectable, Logger } from '@nestjs/common';
import { FileSystemService } from '../../projects/services/file-system.service';
import { Project } from '../../projects/project.entity';
import { RegisterEndpointDto } from '../dto/register-endpoint.dto';
import * as path from 'path';
import * as fs from 'fs/promises';

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
        // If file doesn't exist, create basic structure with testExecutions
        projectMeta = {
          id: project.id,
          name: project.name,
          status: 'ready-with-content',
          endpoints: [],
          testExecutions: {},
        };
      }

      // Ensure testExecutions structure exists
      if (!projectMeta.testExecutions) {
        projectMeta.testExecutions = {};
      }

      // Initialize testExecutions for this entity if it doesn't exist
      if (!projectMeta.testExecutions[dto.entityName]) {
        projectMeta.testExecutions[dto.entityName] = {
          scenarios: {},
          executionHistory: [],
          lastExecution: null,
          totalExecutions: 0,
          successRate: 0,
          averageDuration: 0,
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

      // Initialize scenarios for this entity based on generated artifacts
      await this.initializeScenariosForEntity(projectMeta, dto);

      // Write updated project meta
      await this.fileSystemService.writeFile(
        projectMetaPath,
        JSON.stringify(projectMeta, null, 2),
      );

      console.log('📝 Project meta updated successfully with testExecutions structure');
    } catch (error) {
      console.error('❌ Error updating project meta:', error);
      // Don't throw error to avoid failing the entire generation
    }
  }

  /**
   * Initialize scenarios for an entity based on generated artifacts
   */
  private async initializeScenariosForEntity(projectMeta: any, dto: RegisterEndpointDto) {
    const entityName = dto.entityName;
    const entityExecutions = projectMeta.testExecutions[entityName];

    // Initialize scenarios if they don't exist
    if (!entityExecutions.scenarios) {
      entityExecutions.scenarios = {};
    }

    // Generate default scenarios based on HTTP methods
    const defaultScenarios = this.generateDefaultScenarios(dto);
    
    for (const scenario of defaultScenarios) {
      if (!entityExecutions.scenarios[scenario.name]) {
        entityExecutions.scenarios[scenario.name] = {
          lastStatus: 'pending',
          lastExecution: null,
          totalExecutions: 0,
          successRate: 0,
          averageDuration: 0,
          steps: scenario.steps.reduce((acc, step) => {
            acc[step.name] = {
              lastStatus: 'pending',
              errorRate: 0,
              averageDuration: 0,
              totalExecutions: 0,
            };
            return acc;
          }, {}),
        };
      }
    }
  }

  /**
   * Generate default scenarios based on HTTP methods
   */
  private generateDefaultScenarios(dto: RegisterEndpointDto): Array<{
    name: string;
    method: string;
    steps: Array<{ name: string; type: string }>;
  }> {
    const scenarios: Array<{
      name: string;
      method: string;
      steps: Array<{ name: string; type: string }>;
    }> = [];
    const entityName = dto.entityName;

    for (const methodConfig of dto.methods) {
      const method = methodConfig.method;
      
      switch (method) {
        case 'POST':
          scenarios.push({
            name: `Create a new ${entityName} successfully`,
            method: 'POST',
            steps: [
              { name: 'I have valid data', type: 'Given' },
              { name: 'I create a resource', type: 'When' },
              { name: 'the resource should be created successfully', type: 'Then' },
              { name: 'I should receive a 201 status code', type: 'Then' },
            ]
          });
          scenarios.push({
            name: `Create ${entityName} with invalid data`,
            method: 'POST',
            steps: [
              { name: 'I have invalid data', type: 'Given' },
              { name: 'I create a resource', type: 'When' },
              { name: 'I should receive a validation error', type: 'Then' },
              { name: 'I should receive a 422 status code', type: 'Then' },
            ]
          });
          break;

        case 'GET':
          scenarios.push({
            name: `Get ${entityName} by ID`,
            method: 'GET',
            steps: [
              { name: 'a resource exists in the system', type: 'Given' },
              { name: 'I get the resource by ID', type: 'When' },
              { name: 'I should get the resource details', type: 'Then' },
              { name: 'I should receive a 200 status code', type: 'Then' },
            ]
          });
          break;

        case 'PATCH':
        case 'PUT':
          scenarios.push({
            name: `Update an existing ${entityName}`,
            method: method,
            steps: [
              { name: 'a resource exists in the system', type: 'Given' },
              { name: 'I update the resource', type: 'When' },
              { name: 'the resource should be updated successfully', type: 'Then' },
              { name: 'I should receive a 200 status code', type: 'Then' },
            ]
          });
          break;

        case 'DELETE':
          scenarios.push({
            name: `Delete an existing ${entityName}`,
            method: 'DELETE',
            steps: [
              { name: 'a resource exists in the system', type: 'Given' },
              { name: 'I delete the resource', type: 'When' },
              { name: 'the resource should be deleted successfully', type: 'Then' },
              { name: 'I should receive a 204 status code', type: 'Then' },
            ]
          });
          break;
      }
    }

    return scenarios;
  }

  /**
   * Update test execution results for an entity
   */
  async updateTestExecutionResults(
    projectId: string,
    entityName: string,
    executionResults: any
  ) {
    try {
      const project = await this.getProjectById(projectId);
      if (!project) {
        throw new Error(`Project with ID ${projectId} not found`);
      }

      const projectMetaPath = path.join(project.path, 'project-meta.json');
      const metaContent = await this.fileSystemService.readFile(projectMetaPath);
      const projectMeta = JSON.parse(metaContent);

      // Ensure testExecutions structure exists
      if (!projectMeta.testExecutions) {
        projectMeta.testExecutions = {};
      }

      if (!projectMeta.testExecutions[entityName]) {
        projectMeta.testExecutions[entityName] = {
          scenarios: {},
          executionHistory: [],
          lastExecution: null,
          totalExecutions: 0,
          successRate: 0,
          averageDuration: 0,
        };
      }

      const entityExecutions = projectMeta.testExecutions[entityName];

      // Update execution history
      const executionEntry = {
        executionId: executionResults.executionId,
        timestamp: new Date().toISOString(),
        status: executionResults.status,
        summary: executionResults.summary,
        entityName: entityName,
        method: executionResults.method,
        testType: executionResults.testType,
      };

      entityExecutions.executionHistory.push(executionEntry);

      // Update entity-level statistics
      entityExecutions.lastExecution = executionEntry;
      entityExecutions.totalExecutions += 1;
      entityExecutions.successRate = this.calculateSuccessRate(entityExecutions.executionHistory);
      entityExecutions.averageDuration = this.calculateAverageDuration(entityExecutions.executionHistory);

      // Update scenario-level statistics
      if (executionResults.results) {
        for (const result of executionResults.results) {
          const scenarioName = result.scenarioName;
          
          if (!entityExecutions.scenarios[scenarioName]) {
            entityExecutions.scenarios[scenarioName] = {
              lastStatus: 'pending',
              lastExecution: null,
              totalExecutions: 0,
              successRate: 0,
              averageDuration: 0,
              steps: {},
            };
          }

          const scenario = entityExecutions.scenarios[scenarioName];
          scenario.lastStatus = result.status;
          scenario.lastExecution = new Date().toISOString();
          scenario.totalExecutions += 1;
          scenario.averageDuration = this.calculateScenarioAverageDuration(scenario, result.duration);

          // Update step-level statistics
          if (result.steps) {
            for (const step of result.steps) {
              if (!scenario.steps[step.stepName]) {
                scenario.steps[step.stepName] = {
                  lastStatus: 'pending',
                  errorRate: 0,
                  averageDuration: 0,
                  totalExecutions: 0,
                };
              }

              const stepStats = scenario.steps[step.stepName];
              stepStats.lastStatus = step.status;
              stepStats.totalExecutions += 1;
              stepStats.averageDuration = this.calculateStepAverageDuration(stepStats, step.duration);
              
              if (step.status === 'failed') {
                stepStats.errorRate = (stepStats.errorRate * (stepStats.totalExecutions - 1) + 1) / stepStats.totalExecutions;
              } else {
                stepStats.errorRate = (stepStats.errorRate * (stepStats.totalExecutions - 1)) / stepStats.totalExecutions;
              }
            }
          }
        }
      }

      // Write updated project meta
      await this.fileSystemService.writeFile(
        projectMetaPath,
        JSON.stringify(projectMeta, null, 2),
      );

      this.logger.log(`Test execution results updated for entity: ${entityName}`);
    } catch (error) {
      this.logger.error(`Error updating test execution results: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get test execution history for an entity
   */
  async getTestExecutionHistory(projectId: string, entityName: string) {
    try {
      const project = await this.getProjectById(projectId);
      if (!project) {
        throw new Error(`Project with ID ${projectId} not found`);
      }

      const projectMetaPath = path.join(project.path, 'project-meta.json');
      const metaContent = await this.fileSystemService.readFile(projectMetaPath);
      const projectMeta = JSON.parse(metaContent);

      return projectMeta.testExecutions?.[entityName]?.executionHistory || [];
    } catch (error) {
      this.logger.error(`Error getting test execution history: ${error.message}`);
      return [];
    }
  }

  /**
   * Helper methods for calculations
   */
  private calculateSuccessRate(executionHistory: any[]): number {
    if (executionHistory.length === 0) return 0;
    const successful = executionHistory.filter(exec => exec.status === 'completed').length;
    return successful / executionHistory.length;
  }

  private calculateAverageDuration(executionHistory: any[]): number {
    if (executionHistory.length === 0) return 0;
    const totalDuration = executionHistory.reduce((sum, exec) => sum + (exec.summary?.totalDuration || 0), 0);
    return totalDuration / executionHistory.length;
  }

  private calculateScenarioAverageDuration(scenario: any, newDuration: number): number {
    const totalDuration = (scenario.averageDuration * (scenario.totalExecutions - 1)) + newDuration;
    return totalDuration / scenario.totalExecutions;
  }

  private calculateStepAverageDuration(stepStats: any, newDuration: number): number {
    const totalDuration = (stepStats.averageDuration * (stepStats.totalExecutions - 1)) + newDuration;
    return totalDuration / stepStats.totalExecutions;
  }

  /**
   * Get project by ID using the same logic as WorkspaceService
   */
  private async getProjectById(projectId: string) {
    // Usar la misma lógica que WorkspaceService para obtener la ruta correcta
    const envPath = process.env.PLAYWRIGHT_WORKSPACES_PATH;
    if (!envPath) {
      this.logger.error('PLAYWRIGHT_WORKSPACES_PATH no está definida');
      return null;
    }
    
    let workspacePath = envPath;
    if (!path.isAbsolute(workspacePath)) {
      workspacePath = path.resolve(process.cwd(), workspacePath);
    }
    
    try {
      const workspaces = await fs.readdir(workspacePath);
      for (const workspace of workspaces) {
        const workspaceMetaPath = path.join(workspacePath, workspace, 'project-meta.json');
        try {
          const metaContent = await fs.readFile(workspaceMetaPath, 'utf8');
          const meta = JSON.parse(metaContent);
          if (meta.id === projectId) {
            return {
              id: projectId,
              path: path.join(workspacePath, workspace),
            };
          }
        } catch (error) {
          // Continuar buscando
        }
      }
    } catch (error) {
      this.logger.error(`Error buscando proyecto: ${error.message}`);
    }
    
    this.logger.warn(`No se pudo encontrar la ruta del proyecto ${projectId}`);
    return null;
  }
} 