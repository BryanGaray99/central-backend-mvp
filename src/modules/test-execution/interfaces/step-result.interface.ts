/**
 * Status of an individual step within a scenario.
 */
export enum StepStatus {
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

/**
 * Result details for a single step.
 */
export interface StepResult {
  stepName: string;
  status: StepStatus;
  duration: number; // milliseconds
  errorMessage?: string;
  timestamp: Date;
  isHook?: boolean;
  hookType?: string;
} 