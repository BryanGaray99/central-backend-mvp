import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TestExecution } from './test-execution.entity';

export enum TestResultStatus {
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

@Entity('test_results')
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
    stepDefinition: string;
    status: TestResultStatus;
    duration: number;
    errorMessage?: string;
    data?: any;
    timestamp: Date;
  }[];

  @Column({ nullable: true })
  errorMessage?: string;

  @Column('simple-array', { nullable: true })
  screenshots?: string[]; // paths to screenshot files

  @Column({ nullable: true })
  videoPath?: string; // path to video file

  @Column('json', { nullable: true })
  metadata?: {
    browser?: string;
    viewport?: { width: number; height: number };
    userAgent?: string;
    retryCount?: number;
    tags?: string[];
  };

  @CreateDateColumn()
  createdAt: Date;
} 