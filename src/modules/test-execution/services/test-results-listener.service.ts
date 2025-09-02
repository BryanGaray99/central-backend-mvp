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
   * Inicializa el listener para una nueva ejecución
   */
  initializeExecution(executionId: string): void {
    this.currentExecutionId = executionId;
    this.scenarioResults.clear();
    this.stepResults.clear();
    this.logger.log(`Listener inicializado para ejecución: ${executionId}`);
  }

  /**
   * Captura el inicio de un escenario
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
    
    this.logger.debug(`Escenario iniciado: ${scenarioName}`);
  }

  /**
   * Captura el resultado de un escenario
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
      
      this.logger.debug(`Escenario completado: ${scenarioName} - ${result.status}`);
    }
  }

  /**
   * Captura el inicio de un paso
   */
  captureStepStart(stepName: string): void {
    if (!this.currentScenario) {
      this.logger.warn('Intento de capturar step sin escenario activo');
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
    
    this.logger.debug(`Step iniciado: ${stepName}`);
  }

  /**
   * Captura el resultado de un paso
   */
  captureStepResult(stepName: string, result: any): void {
    if (!this.currentScenario) {
      this.logger.warn('Intento de capturar resultado de step sin escenario activo');
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
      
      this.logger.debug(`Step completado: ${stepName} - ${result.status}`);
    }
  }

  /**
   * Captura datos adicionales de un paso (deprecated - mantenido por compatibilidad)
   */
  captureStepData(stepName: string, data: any): void {
    if (!this.currentScenario) {
      return;
    }

    // Los datos ya no se almacenan en la estructura simplificada
    // Solo se registra en el log para debugging
    this.logger.debug(`Datos capturados para step ${stepName}: ${JSON.stringify(data)}`);
  }

  /**
   * Captura un error durante la ejecución
   */
  captureError(error: Error, context?: string): void {
    this.logger.error(`Error capturado${context ? ` en ${context}` : ''}: ${error.message}`);
    
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
   * Captura metadatos de la ejecución
   */
  captureExecutionMetadata(metadata: any): void {
    this.logger.debug(`Metadatos de ejecución capturados: ${JSON.stringify(metadata)}`);
  }

  /**
   * Obtiene todos los resultados capturados
   */
  getCapturedResults(): any[] {
    return Array.from(this.scenarioResults.values());
  }

  /**
   * Limpia los datos del listener
   */
  cleanup(): void {
    this.currentExecutionId = null;
    this.currentScenario = null;
    this.scenarioResults.clear();
    this.stepResults.clear();
    this.logger.debug('Listener limpiado');
  }

  /**
   * Obtiene el estado actual del listener
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