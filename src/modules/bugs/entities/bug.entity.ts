import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Project } from '../../projects/project.entity';
import { TestCase } from '../../test-cases/entities/test-case.entity';
import { TestSuite } from '../../test-suites/entities/test-suite.entity';

export enum BugType {
  SYSTEM_BUG = 'system_bug',
  FRAMEWORK_ERROR = 'framework_error',
  TEST_FAILURE = 'test_failure',
  ENVIRONMENT_ISSUE = 'environment_issue'
}

export enum BugSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum BugPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum BugStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}

@Entity('bugs')
export class Bug {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'bug_id', unique: true })
  bugId: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column({ name: 'test_case_id', nullable: true })
  testCaseId: string;

  @Column({ name: 'test_suite_id', nullable: true })
  testSuiteId: string;

  @Column({ name: 'execution_id', nullable: true })
  executionId: string;

  // Bug identification
  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'scenario_name', nullable: true })
  scenarioName: string;

  @Column({ name: 'test_case_name', nullable: true })
  testCaseName: string;

  // Bug classification
  @Column({
    type: 'varchar',
    length: 20
  })
  type: BugType;

  @Column({
    type: 'varchar',
    length: 20
  })
  severity: BugSeverity;

  @Column({
    type: 'varchar',
    length: 20,
    default: BugPriority.MEDIUM
  })
  priority: BugPriority;

  // Status tracking
  @Column({
    type: 'varchar',
    length: 20,
    default: BugStatus.OPEN
  })
  status: BugStatus;

  // Error details
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ name: 'error_type', nullable: true })
  errorType: string;

  @Column({ name: 'error_stack', type: 'text', nullable: true })
  errorStack: string;

  @Column({ name: 'error_code', nullable: true })
  errorCode: string;

  // Execution context
  @Column({ nullable: true })
  section: string;

  @Column({ nullable: true })
  entity: string;

  @Column({ nullable: true })
  method: string;

  @Column({ nullable: true })
  endpoint: string;

  @Column({ name: 'request_data', type: 'json', nullable: true })
  requestData: any;

  @Column({ name: 'response_data', type: 'json', nullable: true })
  responseData: any;

  @Column({ name: 'execution_time', nullable: true })
  executionTime: number; // in milliseconds

  @Column({ name: 'execution_date', type: 'datetime', nullable: true })
  executionDate: Date;

  // Logs
  @Column({ name: 'execution_logs', type: 'text', nullable: true })
  executionLogs: string;

  @Column({ name: 'console_logs', type: 'text', nullable: true })
  consoleLogs: string;

  // Environment info
  @Column({ default: 'default' })
  environment: string;

  // Timestamps
  @Column({ name: 'reported_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  reportedAt: Date;

  @Column({ name: 'resolved_at', type: 'datetime', nullable: true })
  resolvedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Project, project => project.bugs)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => TestCase, testCase => testCase.bugs)
  @JoinColumn({ name: 'test_case_id' })
  testCase: TestCase;

  @ManyToOne(() => TestSuite, testSuite => testSuite.bugsList)
  @JoinColumn({ name: 'test_suite_id' })
  testSuite: TestSuite;
}
