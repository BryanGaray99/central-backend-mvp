import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class MetadataUpdaterService {
  private readonly logger = new Logger(MetadataUpdaterService.name);

  /**
   * Actualiza la metadata del proyecto con los resultados de ejecución
   */
  async updateProjectMetadata(
    projectId: string,
    entityName: string,
    executionResults: any,
  ): Promise<void> {
    try {
      // Obtener la ruta del proyecto
      const projectPath = await this.getProjectPath(projectId);
      if (!projectPath) {
        this.logger.warn(`No se pudo encontrar la ruta del proyecto ${projectId}`);
        return;
      }

      const metaPath = path.join(projectPath, 'project-meta.json');
      
      // Leer metadata existente
      let projectMeta;
      try {
        const metaContent = await fs.readFile(metaPath, 'utf8');
        projectMeta = JSON.parse(metaContent);
      } catch (error) {
        // Si el archivo no existe, crear estructura básica
        projectMeta = {
          endpoints: [],
          testExecutions: {},
        };
      }

      // Inicializar estructura de testExecutions si no existe
      if (!projectMeta.testExecutions) {
        projectMeta.testExecutions = {};
      }

      if (!projectMeta.testExecutions[entityName]) {
        projectMeta.testExecutions[entityName] = {
          scenarios: {},
          executionHistory: [],
        };
      }

      // Actualizar información de escenarios
      await this.updateScenarioResults(projectMeta.testExecutions[entityName], executionResults);

      // Agregar a historial de ejecuciones
      this.addToExecutionHistory(projectMeta.testExecutions[entityName], executionResults);

      // Escribir metadata actualizada
      await fs.writeFile(metaPath, JSON.stringify(projectMeta, null, 2), 'utf8');

      this.logger.log(`Metadata actualizada para entidad ${entityName} en proyecto ${projectId}`);
    } catch (error) {
      this.logger.error(`Error actualizando metadata: ${error.message}`);
      // No lanzar error para evitar que falle toda la ejecución
    }
  }

  /**
   * Actualiza los resultados de escenarios específicos
   */
  private async updateScenarioResults(
    entityExecutions: any,
    executionResults: any,
  ): Promise<void> {
    const { results } = executionResults;

    for (const result of results) {
      const scenarioName = result.scenarioName;
      
      if (!entityExecutions.scenarios[scenarioName]) {
        entityExecutions.scenarios[scenarioName] = {
          lastStatus: 'unknown',
          lastExecution: null,
          totalExecutions: 0,
          successRate: 0,
          averageDuration: 0,
          totalDuration: 0,
          steps: {},
        };
      }

      const scenario = entityExecutions.scenarios[scenarioName];
      
      // Actualizar estadísticas del escenario
      scenario.lastStatus = result.status;
      scenario.lastExecution = new Date().toISOString();
      scenario.totalExecutions += 1;
      scenario.totalDuration += result.duration;
      scenario.averageDuration = scenario.totalDuration / scenario.totalExecutions;
      
      // Calcular tasa de éxito
      const successCount = scenario.totalExecutions * (scenario.successRate / 100);
      const newSuccessCount = result.status === 'passed' ? successCount + 1 : successCount;
      scenario.successRate = (newSuccessCount / scenario.totalExecutions) * 100;

      // Actualizar información de pasos
      await this.updateStepResultsInternal(scenario.steps, result.steps);
    }
  }

  /**
   * Actualiza los resultados de pasos específicos (método privado interno)
   */
  private async updateStepResultsInternal(scenarioSteps: any, stepResults: any[]): Promise<void> {
    for (const stepResult of stepResults) {
      const stepName = stepResult.stepName;
      
      if (!scenarioSteps[stepName]) {
        scenarioSteps[stepName] = {
          lastStatus: 'unknown',
          totalExecutions: 0,
          errorRate: 0,
          averageDuration: 0,
          totalDuration: 0,
        };
      }

      const step = scenarioSteps[stepName];
      
      // Actualizar estadísticas del paso
      step.lastStatus = stepResult.status;
      step.totalExecutions += 1;
      step.totalDuration += stepResult.duration;
      step.averageDuration = step.totalDuration / step.totalExecutions;
      
      // Calcular tasa de error
      const errorCount = step.totalExecutions * (step.errorRate / 100);
      const newErrorCount = stepResult.status === 'failed' ? errorCount + 1 : errorCount;
      step.errorRate = (newErrorCount / step.totalExecutions) * 100;
    }
  }

  /**
   * Agrega la ejecución al historial
   */
  private addToExecutionHistory(entityExecutions: any, executionResults: any): void {
    const historyEntry = {
      executionId: executionResults.executionId,
      timestamp: new Date().toISOString(),
      status: executionResults.status,
      summary: executionResults.summary,
      totalScenarios: executionResults.summary.totalScenarios,
      passedScenarios: executionResults.summary.passedScenarios,
      failedScenarios: executionResults.summary.failedScenarios,
      successRate: executionResults.summary.successRate,
      executionTime: executionResults.summary.totalDuration,
    };

    // Agregar al inicio del historial
    entityExecutions.executionHistory.unshift(historyEntry);

    // Mantener solo las últimas 50 ejecuciones
    if (entityExecutions.executionHistory.length > 50) {
      entityExecutions.executionHistory = entityExecutions.executionHistory.slice(0, 50);
    }
  }

  /**
   * Actualiza el estado de un escenario específico
   */
  async updateScenarioStatus(
    projectId: string,
    entityName: string,
    scenarioName: string,
    status: string,
  ): Promise<void> {
    try {
      const projectPath = await this.getProjectPath(projectId);
      if (!projectPath) return;

      const metaPath = path.join(projectPath, 'project-meta.json');
      
      let projectMeta;
      try {
        const metaContent = await fs.readFile(metaPath, 'utf8');
        projectMeta = JSON.parse(metaContent);
      } catch (error) {
        return;
      }

      if (projectMeta.testExecutions?.[entityName]?.scenarios?.[scenarioName]) {
        projectMeta.testExecutions[entityName].scenarios[scenarioName].lastStatus = status;
        projectMeta.testExecutions[entityName].scenarios[scenarioName].lastExecution = new Date().toISOString();
        
        await fs.writeFile(metaPath, JSON.stringify(projectMeta, null, 2), 'utf8');
      }
    } catch (error) {
      this.logger.error(`Error actualizando estado de escenario: ${error.message}`);
    }
  }

  /**
   * Actualiza los resultados de pasos específicos (método público)
   */
  async updateStepResults(
    projectId: string,
    entityName: string,
    scenarioName: string,
    stepResults: any[],
  ): Promise<void> {
    try {
      const projectPath = await this.getProjectPath(projectId);
      if (!projectPath) return;

      const metaPath = path.join(projectPath, 'project-meta.json');
      
      let projectMeta;
      try {
        const metaContent = await fs.readFile(metaPath, 'utf8');
        projectMeta = JSON.parse(metaContent);
      } catch (error) {
        return;
      }

      if (projectMeta.testExecutions?.[entityName]?.scenarios?.[scenarioName]) {
        await this.updateStepResultsInternal(
          projectMeta.testExecutions[entityName].scenarios[scenarioName].steps,
          stepResults,
        );
        
        await fs.writeFile(metaPath, JSON.stringify(projectMeta, null, 2), 'utf8');
      }
    } catch (error) {
      this.logger.error(`Error actualizando resultados de pasos: ${error.message}`);
    }
  }

  /**
   * Obtiene el historial de ejecuciones de una entidad
   */
  async getTestExecutionHistory(projectId: string, entityName: string): Promise<any[]> {
    try {
      const projectPath = await this.getProjectPath(projectId);
      if (!projectPath) return [];

      const metaPath = path.join(projectPath, 'project-meta.json');
      
      const metaContent = await fs.readFile(metaPath, 'utf8');
      const projectMeta = JSON.parse(metaContent);

      return projectMeta.testExecutions?.[entityName]?.executionHistory || [];
    } catch (error) {
      this.logger.error(`Error obteniendo historial de ejecuciones: ${error.message}`);
      return [];
    }
  }

  /**
   * Obtiene la ruta del proyecto
   */
  private async getProjectPath(projectId: string): Promise<string | null> {
    // Esta función debería obtener la ruta del proyecto desde la base de datos
    // Por ahora, asumimos que está en playwright-workspaces
    const workspacePath = path.join(process.cwd(), 'playwright-workspaces');
    
    try {
      const workspaces = await fs.readdir(workspacePath);
      for (const workspace of workspaces) {
        const workspaceMetaPath = path.join(workspacePath, workspace, 'project-meta.json');
        try {
          const metaContent = await fs.readFile(workspaceMetaPath, 'utf8');
          const meta = JSON.parse(metaContent);
          if (meta.id === projectId) {
            return path.join(workspacePath, workspace);
          }
        } catch (error) {
          // Continuar buscando
        }
      }
    } catch (error) {
      this.logger.error(`Error buscando proyecto: ${error.message}`);
    }
    
    return null;
  }
} 