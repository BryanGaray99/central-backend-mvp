import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Endpoint } from '../endpoints/endpoint.entity';
import { TestCase } from '../test-cases/entities/test-case.entity';
import { TestExecution } from '../test-execution/entities/test-execution.entity';
import { AIAssistant } from '../ai/entities/ai-assistant.entity';
import { AIThread } from '../ai/entities/ai-thread.entity';
import { AISuggestion } from '../ai/entities/ai-suggestion.entity';
import { TestSuite } from '../test-suites/entities/test-suite.entity';
import { Bug } from '../bugs/entities/bug.entity';

export enum ProjectStatus {
  PENDING = 'pending',
  READY = 'ready',
  FAILED = 'failed',
}

export enum ProjectType {
  PLAYWRIGHT_BDD = 'playwright-bdd',
  API_ONLY = 'api-only',
}

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  displayName: string;

  @Column('text')
  description: string;

  @Column()
  baseUrl: string;

  @Column({ nullable: true, default: '/v1/api' })
  basePath: string;

  @Column('simple-array')
  tags: string[];

  @Column({
    type: 'varchar',
    length: 20,
    default: ProjectStatus.PENDING
  })
  status: ProjectStatus;

  @Column({
    type: 'varchar',
    length: 20,
    default: ProjectType.PLAYWRIGHT_BDD
  })
  type: ProjectType;

  @Column({ nullable: true })
  path: string;

  @Column({ name: 'assistant_id', nullable: true })
  assistantId: string;

  @Column({ name: 'assistant_created_at', type: 'datetime', nullable: true })
  assistantCreatedAt: Date;

  @Column('json', { nullable: true })
  metadata?: {
    version?: string;
    environment?: string;
    framework?: string;
    dependencies?: string[];
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => Endpoint, endpoint => endpoint.project)
  endpoints: Endpoint[];

  @OneToMany(() => TestCase, testCase => testCase.project)
  testCases: TestCase[];

  @OneToMany(() => TestExecution, testExecution => testExecution.project)
  testExecutions: TestExecution[];

  @OneToMany(() => AIAssistant, assistant => assistant.project)
  aiAssistants: AIAssistant[];

  @OneToMany(() => AIThread, thread => thread.project)
  aiThreads: AIThread[];

  @OneToMany(() => AISuggestion, suggestion => suggestion.project)
  aiSuggestions: AISuggestion[];

  @OneToMany(() => TestSuite, testSuite => testSuite.project)
  testSuites: TestSuite[];

  @OneToMany(() => Bug, bug => bug.project)
  bugs: Bug[];
}
