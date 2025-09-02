import { StepResult, StepStatus } from '../interfaces/step-result.interface';

export interface ParsedResult {
  scenarioName: string;
  scenarioTags: string[];
  status: string;
  duration: number;
  steps: StepResult[];
  errorMessage?: string;
  screenshots?: string[];
  videoPath?: string;
  metadata?: any;
}

export class ResultParserUtils {
  /**
   * Parsea la salida de Cucumber en formato JSON
   */
  static parseCucumberJsonOutput(output: string): ParsedResult[] {
    try {
      // Buscar la salida JSON en el output
      const jsonMatch = output.match(/\[{.*}\]/s);
      if (!jsonMatch) {
        console.warn('No se encontró salida JSON en el resultado de Cucumber');
        return [];
      }

      const jsonOutput = JSON.parse(jsonMatch[0]);
      const results: ParsedResult[] = [];

      for (const feature of jsonOutput) {
        for (const element of feature.elements || []) {
          if (element.type === 'scenario') {
            const scenarioResult = this.parseScenario(element, feature);
            results.push(scenarioResult);
          }
        }
      }

      return results;
    } catch (error) {
      console.error(`Error parseando salida de Cucumber: ${error.message}`);
      return [];
    }
  }

  /**
   * Parsea un escenario individual
   */
  private static parseScenario(element: any, feature: any): ParsedResult {
    const steps = this.parseScenarioSteps(element.steps || []);
    const status = this.determineScenarioStatus(element.steps || []);
    const duration = this.calculateScenarioDuration(element.steps || []);
    const errorMessage = this.extractErrorMessage(element.steps || []);
    const screenshots = this.extractScreenshots(element.steps || []);
    const videoPath = this.extractVideoPath(element.steps || []);

    return {
      scenarioName: element.name,
      scenarioTags: element.tags?.map((tag: any) => tag.name) || [],
      status,
      duration,
      steps,
      errorMessage,
      screenshots,
      videoPath,
      metadata: {
        feature: feature.name,
        featureTags: feature.tags?.map((tag: any) => tag.name) || [],
        line: element.line,
      },
    };
  }

  /**
   * Parsea los pasos de un escenario
   */
  private static parseScenarioSteps(steps: any[]): StepResult[] {
    return steps.map(step => ({
      stepName: step.name,
      stepDefinition: step.keyword + step.name,
      status: this.mapStepStatus(step.result?.status),
      // Cucumber reporta duration en nanosegundos: convertir a milisegundos
      duration: step.result?.duration ? step.result.duration / 1_000_000 : 0,
      errorMessage: step.result?.error_message,
      data: this.extractStepData(step),
      timestamp: new Date(),
      metadata: {
        browser: undefined,
        viewport: undefined,
        userAgent: undefined,
        retryCount: 0,
        line: step.line,
        keyword: step.keyword,
      },
    }));
  }

  /**
   * Mapea el estado del paso de Cucumber a nuestro enum
   */
  private static mapStepStatus(cucumberStatus?: string): StepStatus {
    switch (cucumberStatus) {
      case 'passed':
        return StepStatus.PASSED;
      case 'failed':
        return StepStatus.FAILED;
      case 'skipped':
        return StepStatus.SKIPPED;
      default:
        return StepStatus.FAILED;
    }
  }

  /**
   * Extrae datos relevantes de un paso
   */
  private static extractStepData(step: any): any {
    const data: any = {};

    // Extraer doc string
    if (step.doc_string) {
      data.docString = step.doc_string.content;
    }

    // Extraer data table
    if (step.dataTable) {
      data.dataTable = step.dataTable.rows;
    }

    // Extraer datos del output del paso
    if (step.result?.output) {
      for (const output of step.result.output) {
        if (output.includes('Payload:')) {
          data.payload = output.replace('Payload:', '').trim();
        }
        if (output.includes('Response:')) {
          data.response = output.replace('Response:', '').trim();
        }
        if (output.includes('Status Code:')) {
          data.statusCode = output.replace('Status Code:', '').trim();
        }
        if (output.includes('Headers:')) {
          data.headers = output.replace('Headers:', '').trim();
        }
      }
    }

    return data;
  }

  /**
   * Determina el estado general del escenario
   */
  private static determineScenarioStatus(steps: any[]): string {
    const failedSteps = steps.filter(step => step.result?.status === 'failed');
    const skippedSteps = steps.filter(step => step.result?.status === 'skipped');
    
    if (failedSteps.length > 0) return 'failed';
    if (skippedSteps.length === steps.length) return 'skipped';
    return 'passed';
  }

  /**
   * Calcula la duración total del escenario
   */
  private static calculateScenarioDuration(steps: any[]): number {
    // Convertir sumatoria de nanosegundos a milisegundos
    return steps.reduce((total, step) => {
      if (step.result?.duration) {
        return total + (step.result.duration / 1_000_000);
      }
      return total;
    }, 0);
  }

  /**
   * Extrae el mensaje de error del escenario
   */
  private static extractErrorMessage(steps: any[]): string | undefined {
    const failedStep = steps.find(step => step.result?.status === 'failed');
    return failedStep?.result?.error_message;
  }

  /**
   * Extrae rutas de screenshots
   */
  private static extractScreenshots(steps: any[]): string[] {
    const screenshots: string[] = [];
    
    for (const step of steps) {
      if (step.result?.output) {
        for (const output of step.result.output) {
          if (output.includes('Screenshot saved:')) {
            const screenshotPath = output.replace('Screenshot saved:', '').trim();
            screenshots.push(screenshotPath);
          }
        }
      }
    }

    return screenshots;
  }

  /**
   * Extrae la ruta del video
   */
  private static extractVideoPath(steps: any[]): string | undefined {
    for (const step of steps) {
      if (step.result?.output) {
        for (const output of step.result.output) {
          if (output.includes('Video saved:')) {
            return output.replace('Video saved:', '').trim();
          }
        }
      }
    }
    return undefined;
  }

  /**
   * Genera un resumen de los resultados
   */
  static generateResultsSummary(results: ParsedResult[]): any {
    const totalScenarios = results.length;
    const passedScenarios = results.filter(r => r.status === 'passed').length;
    const failedScenarios = results.filter(r => r.status === 'failed').length;
    const skippedScenarios = results.filter(r => r.status === 'skipped').length;

    const totalSteps = results.reduce((sum, result) => sum + result.steps.length, 0);
    const passedSteps = results.reduce((sum, result) => 
      sum + result.steps.filter(step => step.status === StepStatus.PASSED).length, 0);
    const failedSteps = results.reduce((sum, result) => 
      sum + result.steps.filter(step => step.status === StepStatus.FAILED).length, 0);

    const totalDuration = results.reduce((sum, result) => sum + result.duration, 0);
    const averageDuration = totalScenarios > 0 ? totalDuration / totalScenarios : 0;

    return {
      totalScenarios,
      passedScenarios,
      failedScenarios,
      skippedScenarios,
      successRate: totalScenarios > 0 ? (passedScenarios / totalScenarios) * 100 : 0,
      totalSteps,
      passedSteps,
      failedSteps,
      stepSuccessRate: totalSteps > 0 ? (passedSteps / totalSteps) * 100 : 0,
      totalDuration,
      averageDuration,
      startTime: results.length > 0 ? results[0].metadata?.startTime : null,
      endTime: results.length > 0 ? results[results.length - 1].metadata?.endTime : null,
    };
  }

  /**
   * Filtra resultados por criterios específicos
   */
  static filterResults(results: ParsedResult[], filters: any): ParsedResult[] {
    return results.filter(result => {
      // Filtro por estado
      if (filters.status && result.status !== filters.status) {
        return false;
      }

      // Filtro por tags
      if (filters.tags && filters.tags.length > 0) {
        const hasAllTags = filters.tags.every((tag: string) => 
          result.scenarioTags.includes(tag));
        if (!hasAllTags) {
          return false;
        }
      }

      // Filtro por duración mínima
      if (filters.minDuration && result.duration < filters.minDuration) {
        return false;
      }

      // Filtro por duración máxima
      if (filters.maxDuration && result.duration > filters.maxDuration) {
        return false;
      }

      return true;
    });
  }
} 