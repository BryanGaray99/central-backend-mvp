import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Project } from '../../projects/project.entity';
import { Bug } from '../../bugs/entities/bug.entity';

/**
 * Type of test suite.
 */
export enum TestSuiteType {
  TEST_SET = 'test_set',
  TEST_PLAN = 'test_plan'
}

/**
 * Execution status for test suites.
 */
export enum TestSuiteStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

/**
 * Generic execution lifecycle statuses.
 */
export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Lightweight reference to a test case for suite reporting.
 */
export interface TestCaseReference {
  testCaseId: string;
  testCaseName: string;
  status: TestSuiteStatus;
  executionTime?: number;
  errorMessage?: string;
  executedAt?: Date;
}

/**
 * Lightweight reference to a test set for plans.
 */
export interface TestSetReference {
  testSuiteId: string;
  testSuiteName: string;
  status: TestSuiteStatus;
  totalTestCases: number;
  passedTestCases: number;
  failedTestCases: number;
}

/**
 * Error shape captured for executions.
 */
export interface ExecutionError {
  testCaseId: string;
  testCaseName: string;
  errorMessage: string;
  errorType: string;
  errorStack?: string;
  executionTime: number;
  executedAt: Date;
}

@Entity('test_suites')
/**
 * Entity: TestSuite
 *
 * Represents a collection of test cases (Test Set) or a collection of test sets (Test Plan)
 * with execution statistics and metadata.
 */
export class TestSuite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'suiteId', unique: true })
  suiteId: string;

  @Column({ name: 'projectId' })
  projectId: string;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: TestSuiteType.TEST_SET
  })
  type: TestSuiteType;

  @Column()
  section: string;

  @Column()
  entity: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: TestSuiteStatus.PENDING
  })
  status: TestSuiteStatus;

  @Column('json', { nullable: true })
  testCases: Array<{
    testCaseId: string;
    name: string;
    entityName: string;
    section: string;
  }>;

  @Column('json', { nullable: true })
  testSets: Array<{
    setId: string;
    name: string;
    testCases: string[];
  }>;

  @Column({ name: 'totalTestCases', default: 0 })
  totalTestCases: number;

  @Column({ name: 'passedTestCases', default: 0 })
  passedTestCases: number;

  @Column({ name: 'failedTestCases', default: 0 })
  failedTestCases: number;

  @Column({ name: 'skippedTestCases', default: 0 })
  skippedTestCases: number;

  @Column({ name: 'executionTime', nullable: true })
  executionTime: number; // in milliseconds

  @Column({ name: 'startedAt', type: 'datetime', nullable: true })
  startedAt: Date;

  @Column({ name: 'completedAt', type: 'datetime', nullable: true })
  completedAt: Date;

  @Column({ name: 'lastExecutedAt', type: 'datetime', nullable: true })
  lastExecutedAt: Date;

  @Column('json', { nullable: true })
  errors: any[];

  @Column('json', { nullable: true })
  bugs: any[];

  @Column('text', { nullable: true })
  executionLogs: string;

  @Column('json', { nullable: true })
  tags: string[];

  @Column({ name: 'environment', default: 'default' })
  environment: string;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Project, project => project.testSuites)
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @OneToMany(() => Bug, bug => bug.testSuite)
  bugsList: Bug[];
}
