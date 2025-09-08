import { Before, After, BeforeStep, AfterStep } from '@cucumber/cucumber';
import { TestResultsListenerService } from '../services/test-results-listener.service';

let listenerService: TestResultsListenerService;
let currentExecutionId: string;

/**
 * Initializes Cucumber hooks for capturing execution events.
 *
 * @param executionId - Current execution identifier used for correlation
 * @param listener - Listener service to capture scenario/step events
 */
export function initializeCucumberHooks(
  executionId: string,
  listener: TestResultsListenerService
) {
  currentExecutionId = executionId;
  listenerService = listener;
  listenerService.initializeExecution(executionId);
}

Before(async function(scenario) {
  if (!listenerService || !currentExecutionId) {
    console.warn('Cucumber hooks not properly initialized');
    return;
  }

  const scenarioName = scenario.pickle.name;
  const tags = scenario.pickle.tags.map(tag => tag.name);
  
  // console.log(`🚀 Starting scenario: ${scenarioName}`);
  
  listenerService.captureScenarioStart(
    scenarioName,
    tags
  );
});

After(async function(scenario) {
  if (!listenerService || !currentExecutionId) {
    return;
  }

  const scenarioName = scenario.pickle.name;
  const status = scenario.result?.status === 'PASSED' ? 'passed' : 'failed';
  const duration = scenario.result?.duration || 0;
  const errorMessage = scenario.result?.message;

  // console.log(`✅ **************${status.toUpperCase()}**************`);
  // console.log(`✅ Scenario: ${scenarioName}`);
  // console.log(`✅ ************************************`);

  listenerService.captureScenarioResult(
    scenarioName,
    {
      status,
      duration,
      errorMessage,
      steps: [] // Steps are captured individually
    }
  );
});

BeforeStep(async function(step) {
  if (!listenerService || !currentExecutionId) {
    return;
  }

  // Use a unique identifier for the step
  const stepName = `Step-${Date.now()}`;
  
  listenerService.captureStepStart(
    stepName
  );
});

AfterStep(async function(step) {
  if (!listenerService || !currentExecutionId) {
    return;
  }

  // Use a unique identifier for the step
  const stepName = `Step-${Date.now()}`;
  const status = step.result?.status === 'PASSED' ? 'passed' : 'failed';
  const duration = step.result?.duration || 0;
  const errorMessage = step.result?.message;

  listenerService.captureStepResult(
    stepName,
    {
      status,
      duration,
      errorMessage,
      data: {} // Data can be captured through other mechanisms
    }
  );
}); 