import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Project } from '../../projects/project.entity';
import { Bug } from '../../bugs/entities/bug.entity';

/**
 * Enumeration of test case statuses.
 *
 * @enum TestCaseStatus
 * @since 1.0.0
 */
export enum TestCaseStatus {
  /** Test case is in draft state and not yet active */
  DRAFT = 'draft',
  /** Test case is active and ready for execution */
  ACTIVE = 'active',
  /** Test case is deprecated and should not be used */
  DEPRECATED = 'deprecated',
}

/**
 * Enumeration of test types.
 *
 * @enum TestType
 * @since 1.0.0
 */
export enum TestType {
  /** Positive test case with valid inputs */
  POSITIVE = 'positive',
  /** Negative test case with invalid inputs */
  NEGATIVE = 'negative',
  /** Edge case test with boundary conditions */
  EDGE_CASE = 'edge-case',
}

/**
 * Enumeration of test case priorities.
 *
 * @enum Priority
 * @since 1.0.0
 */
export enum Priority {
  /** Low priority test case */
  LOW = 'low',
  /** Medium priority test case */
  MEDIUM = 'medium',
  /** High priority test case */
  HIGH = 'high',
  /** Critical priority test case */
  CRITICAL = 'critical',
}

/**
 * Enumeration of test case complexity levels.
 *
 * @enum Complexity
 * @since 1.0.0
 */
export enum Complexity {
  /** Simple test case with basic functionality */
  SIMPLE = 'simple',
  /** Medium complexity test case */
  MEDIUM = 'medium',
  /** Complex test case with advanced scenarios */
  COMPLEX = 'complex',
}

/**
 * Test Case Entity
 *
 * This entity represents a test case in the BDD testing system.
 * It contains all the information needed to define and execute
 * a test scenario, including Gherkin steps, hooks, and metadata.
 *
 * @entity TestCase
 * @table test_cases
 * @since 1.0.0
 */
@Entity('test_cases')
export class TestCase {
  /**
   * Unique identifier for the test case record.
   *
   * @example '123e4567-e89b-12d3-a456-426614174000'
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Unique test case identifier for tracking and reference.
   *
   * @example 'TC-ECOMMERCE-01'
   */
  @Column({ unique: true })
  testCaseId: string;

  /**
   * ID of the project this test case belongs to.
   *
   * @example 'project-123'
   */
  @Column()
  projectId: string;

  /**
   * Project relationship.
   *
   * @relation ManyToOne
   */
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  /**
   * Name of the entity being tested.
   *
   * @example 'Product'
   */
  @Column()
  entityName: string;

  /**
   * Section/category for organizing the test case.
   *
   * @example 'ecommerce'
   */
  @Column()
  section: string;

  /**
   * Human-readable name of the test case.
   *
   * @example 'Create a new product with valid data'
   */
  @Column()
  name: string;

  /**
   * Detailed description of what the test case validates.
   *
   * @example 'This test verifies that a new product can be created with all required fields'
   */
  @Column('text')
  description: string;

  /**
   * Array of tags for categorizing and filtering test cases.
   *
   * @example ['smoke', 'regression', 'api']
   */
  @Column('simple-array')
  tags: string[];

  /**
   * HTTP method being tested.
   *
   * @example 'POST'
   */
  @Column()
  method: string;

  /**
   * Type of test case being performed.
   *
   * @default TestType.POSITIVE
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: TestType.POSITIVE,
  })
  testType: TestType;

  /**
   * Gherkin scenario description.
   *
   * @example 'Given I have valid product data\nWhen I send a POST request\nThen the product should be created'
   */
  @Column('text')
  scenario: string;

  /**
   * Hooks configuration for test execution.
   *
   * @example {
   *   before: ['setupDatabase'],
   *   after: ['cleanupData'],
   *   skipDefault: false
   * }
   */
  @Column('json', { nullable: true })
  hooks?: {
    /** Hooks to run before test execution */
    before?: string[];
    /** Hooks to run after test execution */
    after?: string[];
    /** Whether to skip default hooks */
    skipDefault?: boolean;
  };

  /**
   * Test data examples for parameterized testing.
   *
   * @example [
   *   { name: 'Product 1', price: 100 },
   *   { name: 'Product 2', price: 200 }
   * ]
   */
  @Column('json', { nullable: true })
  examples?: Array<Record<string, any>>;

  /**
   * Current status of the test case.
   *
   * @default TestCaseStatus.ACTIVE
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: TestCaseStatus.ACTIVE,
  })
  status: TestCaseStatus;

  /**
   * Timestamp of the last test execution.
   *
   * @example '2024-12-15T10:30:00Z'
   */
  @Column({ nullable: true })
  lastRun?: Date;

  /**
   * Status of the last test execution.
   *
   * @example 'passed'
   */
  @Column({ nullable: true })
  lastRunStatus?: string;

  /**
   * Additional metadata about the test case.
   *
   * @example {
   *   priority: Priority.HIGH,
   *   complexity: Complexity.MEDIUM,
   *   estimatedDuration: 30000,
   *   dependencies: ['TC-ECOMMERCE-02']
   * }
   */
  @Column('json', { nullable: true })
  metadata?: {
    /** Priority level of the test case */
    priority?: Priority;
    /** Complexity level of the test case */
    complexity?: Complexity;
    /** Estimated duration in milliseconds */
    estimatedDuration?: number;
    /** List of dependent test case IDs */
    dependencies?: string[];
  };

  /**
   * Timestamp when the record was created.
   */
  @CreateDateColumn()
  createdAt: Date;

  /**
   * Timestamp when the record was last updated.
   */
  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * Related bugs found during test execution.
   *
   * @relation OneToMany
   */
  @OneToMany(() => Bug, bug => bug.testCase)
  bugs: Bug[];
}

/**
 * Interface for defining test step configurations.
 *
 * This interface represents the structure of a step definition
 * used in test case scenarios.
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