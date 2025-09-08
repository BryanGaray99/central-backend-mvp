import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TestExecution } from './test-execution.entity';

/**
 * Status of an individual test result (scenario level).
 */
export enum TestResultStatus {
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

@Entity('test_results')
/**
 * Entity: TestResult
 *
 * Stores the result of a single executed scenario within a test execution.
 */
export class TestResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  executionId: string;

  @ManyToOne(() => TestExecution, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'executionId' })
  execution: TestExecution;

  @Column()
  scenarioName: string;

  @Column('simple-array', { nullable: true })
  scenarioTags: string[];

  @Column({
    type: 'varchar',
    length: 20,
    default: TestResultStatus.FAILED,
  })
  status: TestResultStatus;

  @Column({ default: 0 })
  duration: number; // milliseconds

  @Column('json', { nullable: true })
  steps: {
    stepName: string;
    status: TestResultStatus;
    duration: number;
    errorMessage?: string;
    timestamp: Date;
    isHook?: boolean;
    hookType?: string;
  }[];

  @Column({ nullable: true })
  errorMessage?: string;

  @Column('json', { nullable: true })
  metadata?: {
    feature?: string;
    tags?: string[];
    scenarioId?: string;
    line?: number;
  };

  @CreateDateColumn()
  createdAt: Date;
} 