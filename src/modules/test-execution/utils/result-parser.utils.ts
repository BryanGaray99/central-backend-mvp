import { StepResult, StepStatus } from '../interfaces/step-result.interface';

/**
 * Structure representing a parsed scenario result from Cucumber JSON.
 */
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

/**
 * Utilities to parse Cucumber JSON output and build summaries.
 */
export class ResultParserUtils {
  /**
   * Parses Cucumber JSON output.
   */
  static parseCucumberJsonOutput(output: string): ParsedResult[] {
    try {
      // Find JSON array in the output
      const jsonMatch = output.match(/\[{.*}\]/s);
      if (!jsonMatch) {
        console.warn('No JSON output found in Cucumber result');
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
      console.error(`Error parsing Cucumber output: ${error.message}`);
      return [];
    }
  }

  /**
   * Parses a single scenario record.
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
   * Parses steps for a scenario.
   */
  private static parseScenarioSteps(steps: any[]): StepResult[] {
    return steps.map(step => ({
      stepName: step.name,
      stepDefinition: step.keyword + step.name,
      status: this.mapStepStatus(step.result?.status),
      // Cucumber reports duration in nanoseconds: convert to milliseconds
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
   * Maps Cucumber step status to the local enum.
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
   * Extracts relevant data from a step.
   */
  private static extractStepData(step: any): any {
    const data: any = {};

    // Extract doc string
    if (step.doc_string) {
      data.docString = step.doc_string.content;
    }

    // Extract data table
    if (step.dataTable) {
      data.dataTable = step.dataTable.rows;
    }

    // Extract data from the step output
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
   * Determines scenario overall status.
   */
  private static determineScenarioStatus(steps: any[]): string {
    const failedSteps = steps.filter(step => step.result?.status === 'failed');
    const skippedSteps = steps.filter(step => step.result?.status === 'skipped');
    
    if (failedSteps.length > 0) return 'failed';
    if (skippedSteps.length === steps.length) return 'skipped';
    return 'passed';
  }

  /**
   * Calculates scenario total duration.
   */
  private static calculateScenarioDuration(steps: any[]): number {
    // Convert sum of nanoseconds to milliseconds
    return steps.reduce((total, step) => {
      if (step.result?.duration) {
        return total + (step.result.duration / 1_000_000);
      }
      return total;
    }, 0);
  }

  /**
   * Extracts the scenario error message.
   */
  private static extractErrorMessage(steps: any[]): string | undefined {
    const failedStep = steps.find(step => step.result?.status === 'failed');
    return failedStep?.result?.error_message;
  }

  /**
   * Extracts screenshot paths from steps.
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
   * Extracts video path from steps.
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
   * Generates a summary for parsed results.
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
   * Filters results using the provided criteria.
   */
  static filterResults(results: ParsedResult[], filters: any): ParsedResult[] {
    return results.filter(result => {
      // Filter by status
      if (filters.status && result.status !== filters.status) {
        return false;
      }

      // Filter by tags
      if (filters.tags && filters.tags.length > 0) {
        const hasAllTags = filters.tags.every((tag: string) => 
          result.scenarioTags.includes(tag));
        if (!hasAllTags) {
          return false;
        }
      }

      // Filter by minimum duration
      if (filters.minDuration && result.duration < filters.minDuration) {
        return false;
      }

      // Filter by maximum duration
      if (filters.maxDuration && result.duration > filters.maxDuration) {
        return false;
      }

      return true;
    });
  }
} 