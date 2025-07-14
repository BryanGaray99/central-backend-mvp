export enum StepStatus {
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export interface StepResult {
  stepName: string;
  status: StepStatus;
  duration: number; // milliseconds
  errorMessage?: string;
  timestamp: Date;
  isHook?: boolean;
  hookType?: string;
} 