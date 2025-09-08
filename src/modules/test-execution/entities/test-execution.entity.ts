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
import { TestResult } from './test-result.entity';

/**
 * Execution status lifecycle for a test execution.
 */
export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Type of test selection for an execution.
 */
export enum TestType {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  ALL = 'all',
}

@Entity('test_executions')
/**
 * Entity: TestExecution
 *
 * Represents a test execution process and its aggregated outcomes for a project.
 */
export class TestExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column({ unique: true })
  executionId: string;

  @Column()
  entityName: string;

  @Column({ nullable: true })
  method?: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: TestType.ALL,
  })
  testType: TestType;

  @Column('simple-array', { nullable: true })
  tags?: string[];

  @Column({ nullable: true })
  specificScenario?: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: ExecutionStatus.PENDING,
  })
  status: ExecutionStatus;

  @CreateDateColumn()
  startedAt: Date;

  @Column({ nullable: true })
  completedAt?: Date;

  @Column({ default: 0 })
  totalScenarios: number;

  @Column({ default: 0 })
  passedScenarios: number;

  @Column({ default: 0 })
  failedScenarios: number;

  @Column({ default: 0 })
  executionTime: number; // milliseconds

  @Column({ nullable: true })
  errorMessage?: string;

  @Column('json', { nullable: true })
  metadata?: {
    environment?: string;
    verbose?: boolean;
    saveLogs?: boolean;
    savePayloads?: boolean;
    parallel?: boolean;
    timeout?: number;
    retries?: number;
    workers?: number;
  };

  @Column({ nullable: true })
  testCaseId?: string;

  @Column({ nullable: true })
  testSuiteId?: string;

  @OneToMany(() => TestResult, (result: TestResult) => result.execution, {
    cascade: true,
  })
  results: TestResult[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 