import { TestType, Priority, Complexity, TestCaseStatus } from '../entities/test-case.entity';
import { StepType, StepTemplateType, Reusability, StepStatus } from '../entities/test-step.entity';

export interface StepDefinition {
  stepId: string;
  parameters?: Record<string, any>;
  order?: number;
}

export interface ScenarioStructure {
  given: StepDefinition[];
  when: StepDefinition[];
  then: StepDefinition[];
}

export interface TestCaseHooks {
  before?: string[];
  after?: string[];
  skipDefault?: boolean;
}

export interface TestCaseMetadata {
  priority?: Priority;
  complexity?: Complexity;
  estimatedDuration?: number;
  dependencies?: string[];
}

export interface TestCase {
  id: string;
  testCaseId: string;
  projectId: string;
  entityName: string;
  section: string;
  name: string;
  description: string;
  tags: string[];
  method: string;
  testType: TestType;
  scenario: ScenarioStructure;
  hooks?: TestCaseHooks;
  examples?: Array<Record<string, any>>;
  status: TestCaseStatus;
  metadata?: TestCaseMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface StepParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  required: boolean;
  defaultValue?: any;
  conditional?: any;
  dynamic?: any;
}

export interface StepValidation {
  testCode: string;
  expectedResult: any;
  timeout: number;
}

export interface StepValidationConfig {
  syntax?: StepValidation;
  runtime?: StepValidation;
  integration?: StepValidation;
}

export interface StepMetadata {
  category?: string;
  complexity?: 'simple' | 'medium' | 'complex';
  reusability?: Reusability;
}

export interface TestStep {
  id: string;
  stepId: string;
  projectId: string;
  name: string;
  definition: string;
  type: StepType;
  stepType: StepTemplateType;
  parameters: StepParameter[];
  implementation: string;
  validation?: StepValidationConfig;
  status: StepStatus;
  metadata?: StepMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestCaseFilters {
  entityName?: string;
  section?: string;
  method?: string;
  testType?: TestType;
  tags?: string[];
  priority?: Priority;
  complexity?: Complexity;
  status?: string;
  search?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
  updatedAtFrom?: string;
  updatedAtTo?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface TestCaseListResponse {
  testCases: TestCase[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: TestCaseFilters;
}

export interface TestCaseStatistics {
  totalCases: number;
  positiveCases: number;
  negativeCases: number;
  edgeCases: number;
  activeCases: number;
  draftCases: number;
  deprecatedCases: number;
  averageDuration: number;
  lastUpdated: Date;
}

export interface StepTemplateStatistics {
  totalSteps: number;
  activeSteps: number;
  deprecatedSteps: number;
  mostUsedSteps: Array<{
    stepId: string;
    name: string;
    usageCount: number;
  }>;
  lastUpdated: Date;
}

export interface TestCaseExport {
  testCaseId: string;
  name: string;
  description: string;
  tags: string[];
  gherkin: string;
  metadata: {
    entityName: string;
    method: string;
    testType: TestType;
    priority?: Priority;
    complexity?: Complexity;
  };
}

export interface DuplicateTestCaseDto {
  newName: string;
  modifications?: {
    tags?: string[];
    metadata?: TestCaseMetadata;
    scenario?: Partial<ScenarioStructure>;
  };
} 