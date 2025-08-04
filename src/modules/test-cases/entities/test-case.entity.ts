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

export enum TestCaseStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
}

export enum TestType {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  EDGE_CASE = 'edge-case',
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum Complexity {
  SIMPLE = 'simple',
  MEDIUM = 'medium',
  COMPLEX = 'complex',
}

@Entity('test_cases')
export class TestCase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  testCaseId: string; // TC-ECOMMERCE-01

  @Column()
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column()
  entityName: string;

  @Column()
  section: string;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column('simple-array')
  tags: string[];

  @Column()
  method: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: TestType.POSITIVE,
  })
  testType: TestType;

  @Column('text')
  scenario: string;

  @Column('json', { nullable: true })
  hooks?: {
    before?: string[];
    after?: string[];
    skipDefault?: boolean;
  };

  @Column('json', { nullable: true })
  examples?: Array<Record<string, any>>;

  @Column({
    type: 'varchar',
    length: 20,
    default: TestCaseStatus.ACTIVE,
  })
  status: TestCaseStatus;

  @Column({ nullable: true })
  lastRun?: Date;

  @Column({ nullable: true })
  lastRunStatus?: string;

  @Column('json', { nullable: true })
  metadata?: {
    priority?: Priority;
    complexity?: Complexity;
    estimatedDuration?: number;
    dependencies?: string[];
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export interface StepDefinition {
  stepId: string;
  parameters?: Record<string, any>;
  order?: number;
} 