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
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'bugId', unique: true })
  bugId: string;

  @Column({ name: 'projectId' })
  projectId: string;

  @Column({ name: 'testCaseId', nullable: true })
  testCaseId: string | null;

  @Column({ name: 'testSuiteId', nullable: true })
  testSuiteId: string | null;

  @Column({ name: 'executionId', nullable: true })
  executionId: string;

  // Bug identification
  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'scenarioName', nullable: true })
  scenarioName: string;

  @Column({ name: 'testCaseName', nullable: true })
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
  @Column({ name: 'errorMessage', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ name: 'errorType', nullable: true })
  errorType: string;

  @Column({ name: 'errorStack', type: 'text', nullable: true })
  errorStack: string;

  @Column({ name: 'errorCode', nullable: true })
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

  @Column({ name: 'requestData', type: 'json', nullable: true })
  requestData: any;

  @Column({ name: 'responseData', type: 'json', nullable: true })
  responseData: any;

  @Column({ name: 'executionTime', nullable: true })
  executionTime: number; // in milliseconds

  @Column({ name: 'executionDate', type: 'datetime', nullable: true })
  executionDate: Date;

  // Logs
  @Column({ name: 'executionLogs', type: 'text', nullable: true })
  executionLogs: string;

  @Column({ name: 'consoleLogs', type: 'text', nullable: true })
  consoleLogs: string;

  // Environment info
  @Column({ default: 'default' })
  environment: string;

  // Timestamps
  @Column({ name: 'reportedAt', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  reportedAt: Date;

  @Column({ name: 'resolvedAt', type: 'datetime', nullable: true })
  resolvedAt: Date;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Project, project => project.bugs)
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @ManyToOne(() => TestCase, testCase => testCase.bugs)
  @JoinColumn({ name: 'testCaseId' })
  testCase: TestCase;

  @ManyToOne(() => TestSuite, testSuite => testSuite.bugsList)
  @JoinColumn({ name: 'testSuiteId' })
  testSuite: TestSuite;
}
