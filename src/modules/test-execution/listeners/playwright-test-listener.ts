import { TestResultsListenerService } from '../services/test-results-listener.service';

// Interfaces para compatibilidad con Playwright
interface Test {
  title: string;
  tags?: string[];
}

interface TestResult {
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: Error;
  steps?: any[];
}

interface TestStep {
  title: string;
}

interface TestStepResult {
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: Error;
}

export class PlaywrightTestListener {
  private currentExecutionId: string;
  private currentScenarioName: string;
  private currentStepName: string;
  private listenerService: TestResultsListenerService;

  constructor(executionId: string, listenerService: TestResultsListenerService) {
    this.currentExecutionId = executionId;
    this.listenerService = listenerService;
    this.listenerService.initializeExecution(executionId);
  }

  onTestStart(test: Test): void {
    this.currentScenarioName = test.title;
    // console.log(`🚀 Starting scenario: ${this.currentScenarioName}`);
    
    this.listenerService.captureScenarioStart(
      this.currentScenarioName,
      test.tags || []
    );
  }

  onTestEnd(test: Test, result: TestResult): void {
    const status = result.status === 'passed' ? 'passed' : 'failed';
    const duration = result.duration;
    const errorMessage = result.error?.message;

    // console.log(`✅ **************${status.toUpperCase()}**************`);
    // console.log(`✅ Scenario: ${this.currentScenarioName}`);
    // console.log(`✅ ************************************`);

    this.listenerService.captureScenarioResult(
      this.currentScenarioName,
      {
        status,
        duration,
        errorMessage,
        steps: result.steps || []
      }
    );
  }

  onStepStart(step: TestStep): void {
    this.currentStepName = step.title;
    
    this.listenerService.captureStepStart(
      this.currentStepName
    );
  }

  onStepEnd(step: TestStep, result: TestStepResult): void {
    const status = result.status === 'passed' ? 'passed' : 'failed';
    const duration = result.duration;
    const errorMessage = result.error?.message;

    this.listenerService.captureStepResult(
      this.currentStepName,
      {
        status,
        duration,
        errorMessage
      }
    );
  }

  onError(error: Error): void {
    console.error(`❌ Test execution error: ${error.message}`);
    
    this.listenerService.captureError(error, 'Playwright Test');
  }
} 