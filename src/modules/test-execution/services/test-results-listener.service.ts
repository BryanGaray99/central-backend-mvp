import { Injectable, Logger } from '@nestjs/common';
import { StepResult, StepStatus } from '../interfaces/step-result.interface';

@Injectable()
export class TestResultsListenerService {
  private readonly logger = new Logger(TestResultsListenerService.name);
  private currentExecutionId: string | null = null;
  private currentScenario: string | null = null;
  private scenarioResults: Map<string, any> = new Map();
  private stepResults: Map<string, StepResult[]> = new Map();

  /**
   * Initializes the listener for a new execution.
   *
   * @param executionId - Execution identifier to correlate captured data
   */
  initializeExecution(executionId: string): void {
    this.currentExecutionId = executionId;
    this.scenarioResults.clear();
    this.stepResults.clear();
    this.logger.log(`Listener initialized for execution: ${executionId}`);
  }

  /**
   * Captures the start of a scenario.
   *
   * @param scenarioName - Scenario name
   * @param tags - Associated scenario tags
   */
  captureScenarioStart(scenarioName: string, tags: string[] = []): void {
    this.currentScenario = scenarioName;
    const scenarioKey = this.getScenarioKey(scenarioName);
    
    this.scenarioResults.set(scenarioKey, {
      scenarioName,
      scenarioTags: tags,
      status: 'running',
      startTime: new Date(),
      steps: [],
      errorMessage: undefined,
      metadata: {
        tags,
        startTime: new Date(),
      },
    });

    this.stepResults.set(scenarioKey, []);
    
    this.logger.debug(`Scenario started: ${scenarioName}`);
  }

  /**
   * Captures the result of a scenario upon completion.
   *
   * @param scenarioName - Scenario name
   * @param result - Result payload including status and timing
   */
  captureScenarioResult(scenarioName: string, result: any): void {
    const scenarioKey = this.getScenarioKey(scenarioName);
    const scenarioData = this.scenarioResults.get(scenarioKey);
    
    if (scenarioData) {
      scenarioData.status = result.status;
      scenarioData.endTime = new Date();
      // result.duration proviene de Cucumber (ns). Convertir a ms
      scenarioData.duration = result.duration ? result.duration / 1_000_000 : 0;
      scenarioData.errorMessage = result.errorMessage;
      // Los screenshots y videos ya no se almacenan en la estructura simplificada
      scenarioData.steps = this.stepResults.get(scenarioKey) || [];
      
      this.scenarioResults.set(scenarioKey, scenarioData);
      
      this.logger.debug(`Scenario completed: ${scenarioName} - ${result.status}`);
    }
  }

  /**
   * Captures the start of a step within the current scenario.
   *
   * @param stepName - Step identifier/name
   */
  captureStepStart(stepName: string): void {
    if (!this.currentScenario) {
      this.logger.warn('Attempted to capture step without active scenario');
      return;
    }

    const scenarioKey = this.getScenarioKey(this.currentScenario);
    const stepResult: StepResult = {
      stepName,
      status: StepStatus.PASSED, // Por defecto, se actualizará al final
      duration: 0,
      timestamp: new Date(),
    };

    const steps = this.stepResults.get(scenarioKey) || [];
    steps.push(stepResult);
    this.stepResults.set(scenarioKey, steps);
    
    this.logger.debug(`Step started: ${stepName}`);
  }

  /**
   * Captures the result for a previously started step.
   *
   * @param stepName - Step identifier/name
   * @param result - Result payload including status and error message
   */
  captureStepResult(stepName: string, result: any): void {
    if (!this.currentScenario) {
      this.logger.warn('Attempted to capture step result without active scenario');
      return;
    }

    const scenarioKey = this.getScenarioKey(this.currentScenario);
    const steps = this.stepResults.get(scenarioKey) || [];
    const stepIndex = steps.findIndex(step => step.stepName === stepName);
    
    if (stepIndex >= 0) {
      const step = steps[stepIndex];
      step.status = result.status || StepStatus.PASSED;
      // Convertir duración de step de ns a ms
      step.duration = result.duration ? result.duration / 1_000_000 : 0;
      step.errorMessage = result.errorMessage;
      
      steps[stepIndex] = step;
      this.stepResults.set(scenarioKey, steps);
      
      this.logger.debug(`Step completed: ${stepName} - ${result.status}`);
    }
  }

  /**
   * Captures additional data for a step (deprecated - kept for compatibility).
   */
  captureStepData(stepName: string, data: any): void {
    if (!this.currentScenario) {
      return;
    }

    // Data is no longer stored; only logged for debugging.
    this.logger.debug(`Captured data for step ${stepName}: ${JSON.stringify(data)}`);
  }

  /**
   * Captures an error during execution.
   */
  captureError(error: Error, context?: string): void {
    this.logger.error(`Captured error${context ? ` in ${context}` : ''}: ${error.message}`);
    
    if (this.currentScenario) {
      const scenarioKey = this.getScenarioKey(this.currentScenario);
      const scenarioData = this.scenarioResults.get(scenarioKey);
      
      if (scenarioData) {
        scenarioData.status = 'failed';
        scenarioData.errorMessage = error.message;
        this.scenarioResults.set(scenarioKey, scenarioData);
      }
    }
  }

  /**
   * Captures execution metadata (for debug/tracing purposes only).
   */
  captureExecutionMetadata(metadata: any): void {
    this.logger.debug(`Captured execution metadata: ${JSON.stringify(metadata)}`);
  }

  /**
   * Returns all captured results in memory.
   */
  getCapturedResults(): any[] {
    return Array.from(this.scenarioResults.values());
  }

  /**
   * Cleans up all in-memory data and resets state.
   */
  cleanup(): void {
    this.currentExecutionId = null;
    this.currentScenario = null;
    this.scenarioResults.clear();
    this.stepResults.clear();
    this.logger.debug('Listener cleaned up');
  }

  /**
   * Returns the current listener status.
   */
  getStatus(): any {
    return {
      executionId: this.currentExecutionId,
      currentScenario: this.currentScenario,
      totalScenarios: this.scenarioResults.size,
      totalSteps: Array.from(this.stepResults.values()).reduce((sum, steps) => sum + steps.length, 0),
    };
  }

  private getScenarioKey(scenarioName: string): string {
    return `${this.currentExecutionId}:${scenarioName}`;
  }
} 