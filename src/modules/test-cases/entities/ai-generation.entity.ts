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

export enum AIGenerationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum AIGenerationType {
  BDD_TEST_CASE = 'bdd-test-case',
  TEST_REFINEMENT = 'test-refinement',
  CODE_VALIDATION = 'code-validation',
}

@Entity('ai_generations')
export class AIGeneration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  generationId: string; // AI-GEN-20241215-001

  @Column()
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column({
    type: 'varchar',
    length: 50,
    default: AIGenerationType.BDD_TEST_CASE,
  })
  type: AIGenerationType;

  @Column()
  entityName: string;

  @Column()
  method: string;

  @Column()
  scenarioName: string;

  @Column({ default: 'ecommerce' })
  section: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: AIGenerationStatus.PENDING,
  })
  status: AIGenerationStatus;

  @Column('text', { nullable: true })
  requestData?: string; // JSON del request original

  @Column('text', { nullable: true })
  generatedCode?: string; // Código generado por IA

  @Column('text', { nullable: true })
  errorMessage?: string;

  @Column('json', { nullable: true })
  metadata?: {
    modelUsed?: string;
    processingTime?: number;
    tokensUsed?: number;
    filesModified?: string[];
    newScenarios?: string[];
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 