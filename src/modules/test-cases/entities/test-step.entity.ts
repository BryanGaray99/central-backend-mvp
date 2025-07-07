import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from '../../projects/project.entity';

export enum StepStatus {
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
}

export enum StepType {
  GIVEN = 'Given',
  WHEN = 'When',
  THEN = 'Then',
  AND = 'And',
  BUT = 'But',
}

export enum StepTemplateType {
  PREDEFINED = 'predefined',
  BUILDER = 'builder',
  CUSTOM = 'custom',
}

export enum Reusability {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

@Entity('test_steps')
export class TestStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  stepId: string; // ST-ECOMMERCE-CREATE-01

  @Column()
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column()
  name: string;

  @Column('text')
  definition: string;

  @Column({
    type: 'varchar',
    length: 10,
  })
  type: StepType;

  @Column({
    type: 'varchar',
    length: 20,
    default: StepTemplateType.PREDEFINED,
  })
  stepType: StepTemplateType;

  @Column('json')
  parameters: {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object';
    required: boolean;
    defaultValue?: any;
    conditional?: any;
    dynamic?: any;
  }[];

  @Column('text')
  implementation: string;

  @Column('json', { nullable: true })
  validation?: {
    syntax?: StepValidation;
    runtime?: StepValidation;
    integration?: StepValidation;
  };

  @Column({
    type: 'varchar',
    length: 20,
    default: StepStatus.ACTIVE,
  })
  status: StepStatus;

  @Column('json', { nullable: true })
  metadata?: {
    category?: string;
    complexity?: 'simple' | 'medium' | 'complex';
    reusability?: Reusability;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export interface StepValidation {
  testCode: string;
  expectedResult: any;
  timeout: number;
} 