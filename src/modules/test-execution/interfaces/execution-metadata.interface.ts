/**
 * Execution-level metadata captured during a run.
 */
export interface ExecutionMetadata {
  environment?: string;
  verbose?: boolean;
  saveLogs?: boolean;
  savePayloads?: boolean;
  parallel?: boolean;
  timeout?: number;
  retries?: number;
  workers?: number;
  tags?: string[];
  customConfig?: Record<string, any>;
}

/**
 * Aggregated metrics for a test execution.
 */
export interface TestSummary {
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  skippedScenarios: number;
  successRate: number;
  averageDuration: number;
  totalDuration: number;
  startTime: Date;
  endTime: Date;
}

/**
 * Complete execution report structure.
 */
export interface ExecutionReport {
  executionId: string;
  status: string;
  summary: TestSummary;
  results: any[];
  metadata: ExecutionMetadata;
  errorDetails?: {
    message: string;
    stack?: string;
    type: string;
  };
} 