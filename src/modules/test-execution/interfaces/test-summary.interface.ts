export interface TestSummary {
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  skippedScenarios: number;
  successRate: number;
  totalDuration: number;
  averageDuration: number;
  startTime: Date;
  endTime: Date;
}

export interface ExecutionSummary {
  executionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  summary: TestSummary;
  errorMessage?: string;
}

export interface ExecutionHistory {
  executionId: string;
  timestamp: Date;
  status: 'completed' | 'failed';
  summary: TestSummary;
  entityName: string;
  method?: string;
  testType?: string;
} 