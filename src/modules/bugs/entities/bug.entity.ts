import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Project } from '../../projects/project.entity';
import { TestCase } from '../../test-cases/entities/test-case.entity';
import { TestSuite } from '../../test-suites/entities/test-suite.entity';

/**
 * Bug Type Enumeration
 * 
 * Defines the different types of bugs that can be reported.
 * 
 * @enum BugType
 */
export enum BugType {
  /** System-level bugs in the application */
  SYSTEM_BUG = 'system_bug',
  /** Framework or infrastructure errors */
  FRAMEWORK_ERROR = 'framework_error',
  /** Test execution failures */
  TEST_FAILURE = 'test_failure',
  /** Environment-related issues */
  ENVIRONMENT_ISSUE = 'environment_issue'
}

/**
 * Bug Severity Enumeration
 * 
 * Defines the severity levels for bugs based on their impact.
 * 
 * @enum BugSeverity
 */
export enum BugSeverity {
  /** Low impact bugs */
  LOW = 'low',
  /** Medium impact bugs */
  MEDIUM = 'medium',
  /** High impact bugs */
  HIGH = 'high',
  /** Critical impact bugs */
  CRITICAL = 'critical'
}

/**
 * Bug Priority Enumeration
 * 
 * Defines the priority levels for bug resolution.
 * 
 * @enum BugPriority
 */
export enum BugPriority {
  /** Low priority bugs */
  LOW = 'low',
  /** Medium priority bugs */
  MEDIUM = 'medium',
  /** High priority bugs */
  HIGH = 'high',
  /** Critical priority bugs */
  CRITICAL = 'critical'
}

/**
 * Bug Status Enumeration
 * 
 * Defines the lifecycle status of bugs.
 * 
 * @enum BugStatus
 */
export enum BugStatus {
  /** Newly reported bug */
  OPEN = 'open',
  /** Bug is being worked on */
  IN_PROGRESS = 'in_progress',
  /** Bug has been fixed */
  RESOLVED = 'resolved',
  /** Bug has been closed */
  CLOSED = 'closed'
}

/**
 * Bug Entity
 * 
 * Represents a bug report in the system with comprehensive tracking
 * information including identification, classification, error details,
 * execution context, and lifecycle management.
 * 
 * @entity Bug
 */
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

  /** Bug identification and description */
  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'scenarioName', nullable: true })
  scenarioName: string;

  @Column({ name: 'testCaseName', nullable: true })
  testCaseName: string;

  /** Bug classification and priority */
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

  /** Status tracking */
  @Column({
    type: 'varchar',
    length: 20,
    default: BugStatus.OPEN
  })
  status: BugStatus;

  /** Error details and debugging information */
  @Column({ name: 'errorMessage', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ name: 'errorType', nullable: true })
  errorType: string;

  @Column({ name: 'errorStack', type: 'text', nullable: true })
  errorStack: string;

  @Column({ name: 'errorCode', nullable: true })
  errorCode: string;

  /** Execution context and test information */
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

  /** Logs and debugging information */
  @Column({ name: 'executionLogs', type: 'text', nullable: true })
  executionLogs: string;

  @Column({ name: 'consoleLogs', type: 'text', nullable: true })
  consoleLogs: string;

  /** Environment information */
  @Column({ default: 'default' })
  environment: string;

  /** Timestamps for lifecycle tracking */
  @Column({ name: 'reportedAt', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  reportedAt: Date;

  @Column({ name: 'resolvedAt', type: 'datetime', nullable: true })
  resolvedAt: Date;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  /** Database relations */
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
