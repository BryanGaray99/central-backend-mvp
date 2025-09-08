import { TestType, Priority, Complexity, TestCaseStatus } from '../entities/test-case.entity';
import { StepType, StepTemplateType, Reusability, StepStatus } from '../entities/test-step.entity';

/**
 * Test Case Interfaces
 *
 * This module contains all the TypeScript interfaces used throughout the test cases system.
 * These interfaces define the structure and contracts for test cases, test steps, filters,
 * responses, and other related data structures.
 *
 * @module TestCaseInterfaces
 * @since 1.0.0
 */

/**
 * Interface for defining test step configurations.
 *
 * @interface StepDefinition
 * @since 1.0.0
 */
export interface StepDefinition {
  /**
   * Unique identifier for the step.
   *
   * @example 'ST-ECOMMERCE-CREATE-01'
   */
  stepId: string;

  /**
   * Parameters to be passed to the step implementation.
   *
   * @example { productName: 'Test Product', price: 100 }
   */
  parameters?: Record<string, any>;

  /**
   * Execution order of the step within the scenario.
   *
   * @example 1
   */
  order?: number;
}

/**
 * Interface for organizing scenario steps by Gherkin type.
 *
 * @interface ScenarioStructure
 * @since 1.0.0
 */
export interface ScenarioStructure {
  /**
   * Array of Given steps (preconditions).
   */
  given: StepDefinition[];

  /**
   * Array of When steps (actions).
   */
  when: StepDefinition[];

  /**
   * Array of Then steps (assertions).
   */
  then: StepDefinition[];
}

/**
 * Interface for test case hooks configuration.
 *
 * @interface TestCaseHooks
 * @since 1.0.0
 */
export interface TestCaseHooks {
  /**
   * Hooks to run before test execution.
   *
   * @example ['setupDatabase', 'loginUser']
   */
  before?: string[];

  /**
   * Hooks to run after test execution.
   *
   * @example ['cleanupData', 'logoutUser']
   */
  after?: string[];

  /**
   * Whether to skip default hooks.
   *
   * @default false
   */
  skipDefault?: boolean;
}

/**
 * Interface for test case metadata.
 *
 * @interface TestCaseMetadata
 * @since 1.0.0
 */
export interface TestCaseMetadata {
  /**
   * Priority level of the test case.
   */
  priority?: Priority;

  /**
   * Complexity level of the test case.
   */
  complexity?: Complexity;

  /**
   * Estimated duration in milliseconds.
   *
   * @example 30000
   */
  estimatedDuration?: number;

  /**
   * List of dependent test case IDs.
   *
   * @example ['TC-ECOMMERCE-02', 'TC-ECOMMERCE-03']
   */
  dependencies?: string[];
}

/**
 * Interface for test case data structure.
 *
 * @interface TestCase
 * @since 1.0.0
 */
export interface TestCase {
  /**
   * Unique identifier for the test case.
   */
  id: string;

  /**
   * Unique test case identifier for tracking.
   *
   * @example 'TC-ECOMMERCE-01'
   */
  testCaseId: string;

  /**
   * ID of the project this test case belongs to.
   */
  projectId: string;

  /**
   * Name of the entity being tested.
   *
   * @example 'Product'
   */
  entityName: string;

  /**
   * Section/category for organizing the test case.
   *
   * @example 'ecommerce'
   */
  section: string;

  /**
   * Human-readable name of the test case.
   *
   * @example 'Create a new product with valid data'
   */
  name: string;

  /**
   * Detailed description of the test case.
   */
  description: string;

  /**
   * Array of tags for categorization.
   *
   * @example ['smoke', 'regression', 'api']
   */
  tags: string[];

  /**
   * HTTP method being tested.
   *
   * @example 'POST'
   */
  method: string;

  /**
   * Type of test case.
   */
  testType: TestType;

  /**
   * Structured scenario with Given/When/Then steps.
   */
  scenario: ScenarioStructure;

  /**
   * Optional hooks configuration.
   */
  hooks?: TestCaseHooks;

  /**
   * Optional test data examples.
   */
  examples?: Array<Record<string, any>>;

  /**
   * Current status of the test case.
   */
  status: TestCaseStatus;

  /**
   * Optional metadata about the test case.
   */
  metadata?: TestCaseMetadata;

  /**
   * Timestamp when the test case was created.
   */
  createdAt: Date;

  /**
   * Timestamp when the test case was last updated.
   */
  updatedAt: Date;
}

/**
 * Interface for step parameter definitions.
 *
 * @interface StepParameter
 * @since 1.0.0
 */
export interface StepParameter {
  /**
   * Name of the parameter.
   *
   * @example 'productName'
   */
  name: string;

  /**
   * Data type of the parameter.
   */
  type: 'string' | 'number' | 'boolean' | 'object';

  /**
   * Whether the parameter is required.
   */
  required: boolean;

  /**
   * Default value for the parameter.
   */
  defaultValue?: any;

  /**
   * Conditional logic for the parameter.
   */
  conditional?: any;

  /**
   * Dynamic behavior configuration.
   */
  dynamic?: any;
}

/**
 * Interface for step validation rules.
 *
 * @interface StepValidation
 * @since 1.0.0
 */
export interface StepValidation {
  /**
   * Test code to execute for validation.
   *
   * @example 'expect(response.status).toBe(200)'
   */
  testCode: string;

  /**
   * Expected result of the validation.
   */
  expectedResult: any;

  /**
   * Timeout in milliseconds for the validation.
   *
   * @example 5000
   */
  timeout: number;
}

/**
 * Interface for step validation configuration.
 *
 * @interface StepValidationConfig
 * @since 1.0.0
 */
export interface StepValidationConfig {
  /**
   * Syntax validation configuration.
   */
  syntax?: StepValidation;

  /**
   * Runtime validation configuration.
   */
  runtime?: StepValidation;

  /**
   * Integration validation configuration.
   */
  integration?: StepValidation;
}

/**
 * Interface for step metadata.
 *
 * @interface StepMetadata
 * @since 1.0.0
 */
export interface StepMetadata {
  /**
   * Category of the step.
   *
   * @example 'api'
   */
  category?: string;

  /**
   * Complexity level of the step.
   */
  complexity?: 'simple' | 'medium' | 'complex';

  /**
   * Reusability level of the step.
   */
  reusability?: Reusability;
}

/**
 * Interface for test step data structure.
 *
 * @interface TestStep
 * @since 1.0.0
 */
export interface TestStep {
  /**
   * Unique identifier for the test step.
   */
  id: string;

  /**
   * Unique step identifier for tracking.
   *
   * @example 'ST-ECOMMERCE-CREATE-01'
   */
  stepId: string;

  /**
   * ID of the project this step belongs to.
   */
  projectId: string;

  /**
   * Human-readable name of the step.
   *
   * @example 'Create a new product'
   */
  name: string;

  /**
   * Gherkin step definition with placeholders.
   *
   * @example 'Given I have a valid {productName} with price {price}'
   */
  definition: string;

  /**
   * Type of Gherkin step.
   */
  type: StepType;

  /**
   * Type of step template.
   */
  stepType: StepTemplateType;

  /**
   * Array of parameters for the step.
   */
  parameters: StepParameter[];

  /**
   * Implementation code for the step.
   */
  implementation: string;

  /**
   * Optional validation configuration.
   */
  validation?: StepValidationConfig;

  /**
   * Current status of the step.
   */
  status: StepStatus;

  /**
   * Optional metadata about the step.
   */
  metadata?: StepMetadata;

  /**
   * Timestamp when the step was created.
   */
  createdAt: Date;

  /**
   * Timestamp when the step was last updated.
   */
  updatedAt: Date;
}

/**
 * Interface for test case filtering options.
 *
 * @interface TestCaseFilters
 * @since 1.0.0
 */
export interface TestCaseFilters {
  /**
   * Filter by entity name.
   *
   * @example 'Product'
   */
  entityName?: string;

  /**
   * Filter by section.
   *
   * @example 'ecommerce'
   */
  section?: string;

  /**
   * Filter by HTTP method.
   *
   * @example 'POST'
   */
  method?: string;

  /**
   * Filter by test type.
   */
  testType?: TestType;

  /**
   * Filter by tags.
   *
   * @example ['smoke', 'regression']
   */
  tags?: string[];

  /**
   * Filter by priority.
   */
  priority?: Priority;

  /**
   * Filter by complexity.
   */
  complexity?: Complexity;

  /**
   * Filter by status.
   *
   * @example 'active'
   */
  status?: string;

  /**
   * Search term for name or description.
   *
   * @example 'create product'
   */
  search?: string;

  /**
   * Filter by creation date from.
   *
   * @example '2024-01-01'
   */
  createdAtFrom?: string;

  /**
   * Filter by creation date to.
   *
   * @example '2024-12-31'
   */
  createdAtTo?: string;

  /**
   * Filter by update date from.
   *
   * @example '2024-01-01'
   */
  updatedAtFrom?: string;

  /**
   * Filter by update date to.
   *
   * @example '2024-12-31'
   */
  updatedAtTo?: string;

  /**
   * Page number for pagination.
   *
   * @default 1
   */
  page?: number;

  /**
   * Number of items per page.
   *
   * @default 10
   */
  limit?: number;

  /**
   * Field to sort by.
   *
   * @example 'createdAt'
   */
  sortBy?: string;

  /**
   * Sort order.
   *
   * @default 'DESC'
   */
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Interface for test case list response.
 *
 * @interface TestCaseListResponse
 * @since 1.0.0
 */
export interface TestCaseListResponse {
  /**
   * Array of test cases.
   */
  testCases: TestCase[];

  /**
   * Pagination information.
   */
  pagination: {
    /** Current page number */
    page: number;
    /** Number of items per page */
    limit: number;
    /** Total number of items */
    total: number;
    /** Total number of pages */
    totalPages: number;
  };

  /**
   * Applied filters.
   */
  filters: TestCaseFilters;
}

/**
 * Interface for test case statistics.
 *
 * @interface TestCaseStatistics
 * @since 1.0.0
 */
export interface TestCaseStatistics {
  /**
   * Total number of test cases.
   */
  totalCases: number;

  /**
   * Number of positive test cases.
   */
  positiveCases: number;

  /**
   * Number of negative test cases.
   */
  negativeCases: number;

  /**
   * Number of edge case test cases.
   */
  edgeCases: number;

  /**
   * Number of active test cases.
   */
  activeCases: number;

  /**
   * Number of draft test cases.
   */
  draftCases: number;

  /**
   * Number of deprecated test cases.
   */
  deprecatedCases: number;

  /**
   * Average duration of test cases in milliseconds.
   */
  averageDuration: number;

  /**
   * Timestamp of last statistics update.
   */
  lastUpdated: Date;
}

/**
 * Interface for step template statistics.
 *
 * @interface StepTemplateStatistics
 * @since 1.0.0
 */
export interface StepTemplateStatistics {
  /**
   * Total number of step templates.
   */
  totalSteps: number;

  /**
   * Number of active step templates.
   */
  activeSteps: number;

  /**
   * Number of deprecated step templates.
   */
  deprecatedSteps: number;

  /**
   * Array of most used steps with usage counts.
   */
  mostUsedSteps: Array<{
    /** Step identifier */
    stepId: string;
    /** Step name */
    name: string;
    /** Number of times the step is used */
    usageCount: number;
  }>;

  /**
   * Timestamp of last statistics update.
   */
  lastUpdated: Date;
}

/**
 * Interface for test case export data.
 *
 * @interface TestCaseExport
 * @since 1.0.0
 */
export interface TestCaseExport {
  /**
   * Test case identifier.
   *
   * @example 'TC-ECOMMERCE-01'
   */
  testCaseId: string;

  /**
   * Test case name.
   *
   * @example 'Create a new product with valid data'
   */
  name: string;

  /**
   * Test case description.
   */
  description: string;

  /**
   * Array of tags.
   *
   * @example ['smoke', 'regression', 'api']
   */
  tags: string[];

  /**
   * Gherkin scenario text.
   *
   * @example 'Given I have valid product data\nWhen I send a POST request\nThen the product should be created'
   */
  gherkin: string;

  /**
   * Test case metadata.
   */
  metadata: {
    /** Entity name */
    entityName: string;
    /** HTTP method */
    method: string;
    /** Test type */
    testType: TestType;
    /** Optional priority */
    priority?: Priority;
    /** Optional complexity */
    complexity?: Complexity;
  };
}

/**
 * Interface for duplicating test cases.
 *
 * @interface DuplicateTestCaseDto
 * @since 1.0.0
 */
export interface DuplicateTestCaseDto {
  /**
   * New name for the duplicated test case.
   *
   * @example 'Create a new product with valid data (Copy)'
   */
  newName: string;

  /**
   * Optional modifications to apply to the duplicated test case.
   */
  modifications?: {
    /** New tags for the test case */
    tags?: string[];
    /** New metadata for the test case */
    metadata?: TestCaseMetadata;
    /** Partial scenario modifications */
    scenario?: Partial<ScenarioStructure>;
  };
} 