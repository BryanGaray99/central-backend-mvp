export enum StepStatus {
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export interface StepResult {
  stepName: string;
  stepDefinition: string;
  status: StepStatus;
  duration: number; // milliseconds
  errorMessage?: string;
  data?: any; // datos del step (payload, response, etc.)
  timestamp: Date;
  metadata?: {
    browser?: string;
    viewport?: { width: number; height: number };
    userAgent?: string;
    retryCount?: number;
  };
} 