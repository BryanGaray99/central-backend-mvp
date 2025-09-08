import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ExecutionLoggerService {
  private readonly logger = new Logger(ExecutionLoggerService.name);

  /**
   * Logs information about a completed execution.
   *
   * @param projectId - Project identifier
   * @param entityName - Entity name
   * @param executionResults - Aggregated execution results
   */
  async logExecutionCompleted(
    projectId: string,
    entityName: string,
    executionResults: any,
  ): Promise<void> {
    try {
      this.logger.log(`Execution completed for entity ${entityName} in project ${projectId}`);
      this.logger.log(`Execution ${executionResults.executionId} completed with ${executionResults.summary.totalScenarios} scenarios`);
    } catch (error) {
      this.logger.error(`Error logging execution: ${error.message}`);
      // Do not throw to avoid failing the whole execution path
    }
  }

  /**
   * Logs scenario status changes.
   *
   * @param projectId - Project identifier
   * @param entityName - Entity name
   * @param scenarioName - Scenario name
   * @param status - New scenario status
   */
  async logScenarioStatusChange(
    projectId: string,
    entityName: string,
    scenarioName: string,
    status: string,
  ): Promise<void> {
    try {
      this.logger.log(`Scenario status updated: ${scenarioName} -> ${status} in project ${projectId}`);
    } catch (error) {
      this.logger.error(`Error logging scenario status change: ${error.message}`);
    }
  }

  /**
   * Logs processed step results for a scenario.
   *
   * @param projectId - Project identifier
   * @param entityName - Entity name
   * @param scenarioName - Scenario name
   * @param stepResults - Array of step results
   */
  async logStepResults(
    projectId: string,
    entityName: string,
    scenarioName: string,
    stepResults: any[],
  ): Promise<void> {
    try {
      this.logger.log(`Processed step results for scenario ${scenarioName} in project ${projectId}`);
      this.logger.log(`Total processed steps: ${stepResults.length}`);
    } catch (error) {
      this.logger.error(`Error logging step results: ${error.message}`);
    }
  }

  /**
   * Logs a request for execution history.
   *
   * @param projectId - Project identifier
   * @param entityName - Entity name
   */
  async logExecutionHistoryRequest(projectId: string, entityName: string): Promise<void> {
    try {
      this.logger.log(`Execution history requested for entity ${entityName} in project ${projectId}`);
    } catch (error) {
      this.logger.error(`Error logging history request: ${error.message}`);
    }
  }
} 