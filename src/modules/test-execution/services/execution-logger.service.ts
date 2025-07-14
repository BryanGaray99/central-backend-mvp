import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ExecutionLoggerService {
  private readonly logger = new Logger(ExecutionLoggerService.name);

  /**
   * Registra información sobre la ejecución completada
   */
  async logExecutionCompleted(
    projectId: string,
    entityName: string,
    executionResults: any,
  ): Promise<void> {
    try {
      this.logger.log(`Ejecución completada para entidad ${entityName} en proyecto ${projectId}`);
      this.logger.log(`Ejecución ${executionResults.executionId} completada con ${executionResults.summary.totalScenarios} escenarios`);
    } catch (error) {
      this.logger.error(`Error registrando ejecución: ${error.message}`);
      // No lanzar error para evitar que falle toda la ejecución
    }
  }

  /**
   * Registra el cambio de estado de un escenario
   */
  async logScenarioStatusChange(
    projectId: string,
    entityName: string,
    scenarioName: string,
    status: string,
  ): Promise<void> {
    try {
      this.logger.log(`Estado de escenario actualizado: ${scenarioName} -> ${status} en proyecto ${projectId}`);
    } catch (error) {
      this.logger.error(`Error registrando cambio de estado de escenario: ${error.message}`);
    }
  }

  /**
   * Registra los resultados de pasos procesados
   */
  async logStepResults(
    projectId: string,
    entityName: string,
    scenarioName: string,
    stepResults: any[],
  ): Promise<void> {
    try {
      this.logger.log(`Resultados de pasos procesados para escenario ${scenarioName} en proyecto ${projectId}`);
      this.logger.log(`Total de pasos procesados: ${stepResults.length}`);
    } catch (error) {
      this.logger.error(`Error registrando resultados de pasos: ${error.message}`);
    }
  }

  /**
   * Registra la obtención del historial de ejecuciones
   */
  async logExecutionHistoryRequest(projectId: string, entityName: string): Promise<void> {
    try {
      this.logger.log(`Solicitud de historial de ejecuciones para entidad ${entityName} en proyecto ${projectId}`);
    } catch (error) {
      this.logger.error(`Error registrando solicitud de historial: ${error.message}`);
    }
  }
} 