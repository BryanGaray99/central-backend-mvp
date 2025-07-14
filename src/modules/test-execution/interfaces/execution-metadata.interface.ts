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