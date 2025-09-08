import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Endpoint } from '../endpoints/endpoint.entity';
import { TestCase } from '../test-cases/entities/test-case.entity';
import { TestExecution } from '../test-execution/entities/test-execution.entity';
import { AIAssistant } from '../ai/entities/ai-assistant.entity';
import { AIThread } from '../ai/entities/ai-thread.entity';
import { AISuggestion } from '../ai/entities/ai-suggestion.entity';
import { TestSuite } from '../test-suites/entities/test-suite.entity';
import { Bug } from '../bugs/entities/bug.entity';

/**
 * Project status enumeration.
 * 
 * Defines the possible states a project can be in during its lifecycle.
 * 
 * @enum ProjectStatus
 * @since 1.0.0
 */
export enum ProjectStatus {
  /** Project is being created or initialized */
  PENDING = 'pending',
  /** Project is ready for use */
  READY = 'ready',
  /** Project creation or initialization failed */
  FAILED = 'failed',
}

/**
 * Project type enumeration.
 * 
 * Defines the different types of testing projects supported by the system.
 * 
 * @enum ProjectType
 * @since 1.0.0
 */
export enum ProjectType {
  /** Playwright with BDD (Behavior Driven Development) testing */
  PLAYWRIGHT_BDD = 'playwright-bdd',
  /** API-only testing without UI components */
  API_ONLY = 'api-only',
}

/**
 * Project entity representing a testing project.
 * 
 * This entity manages the core information about testing projects, including
 * their configuration, status, and relationships with other entities like
 * endpoints, test cases, and AI assistants.
 * 
 * @entity Project
 * @table projects
 * @since 1.0.0
 */
@Entity('projects')
export class Project {
  /** Unique identifier for the project */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Unique name identifier for the project (used for workspace) */
  @Column({ unique: true })
  name: string;

  /** Human-readable display name for the project */
  @Column({ nullable: true })
  displayName: string;

  /** Project description */
  @Column('text')
  description: string;

  /** Base URL for API testing */
  @Column()
  baseUrl: string;

  /** Base path for API endpoints */
  @Column({ nullable: true, default: '/v1/api' })
  basePath: string;

  /** Array of tags associated with the project */
  @Column('simple-array')
  tags: string[];

  /** Current status of the project */
  @Column({
    type: 'varchar',
    length: 20,
    default: ProjectStatus.PENDING
  })
  status: ProjectStatus;

  /** Type of testing project */
  @Column({
    type: 'varchar',
    length: 20,
    default: ProjectType.PLAYWRIGHT_BDD
  })
  type: ProjectType;

  /** File system path to the project workspace */
  @Column({ nullable: true })
  path: string;

  /** Associated AI assistant identifier */
  @Column({ name: 'assistant_id', nullable: true })
  assistantId: string;

  /** Timestamp when the AI assistant was created */
  @Column({ name: 'assistant_created_at', type: 'datetime', nullable: true })
  assistantCreatedAt: Date;

  /** Additional project metadata */
  @Column('json', { nullable: true })
  metadata?: {
    /** Project version */
    version?: string;
    /** Target environment */
    environment?: string;
    /** Testing framework used */
    framework?: string;
    /** List of project dependencies */
    dependencies?: string[];
  };

  /** Timestamp when the project was created */
  @CreateDateColumn()
  createdAt: Date;

  /** Timestamp when the project was last updated */
  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  /** Associated API endpoints */
  @OneToMany(() => Endpoint, endpoint => endpoint.project)
  endpoints: Endpoint[];

  /** Associated test cases */
  @OneToMany(() => TestCase, testCase => testCase.project)
  testCases: TestCase[];

  /** Associated test executions */
  @OneToMany(() => TestExecution, testExecution => testExecution.project)
  testExecutions: TestExecution[];

  /** Associated AI assistants */
  @OneToMany(() => AIAssistant, assistant => assistant.project)
  aiAssistants: AIAssistant[];

  /** Associated AI threads */
  @OneToMany(() => AIThread, thread => thread.project)
  aiThreads: AIThread[];

  /** Associated AI suggestions */
  @OneToMany(() => AISuggestion, suggestion => suggestion.project)
  aiSuggestions: AISuggestion[];

  /** Associated test suites */
  @OneToMany(() => TestSuite, testSuite => testSuite.project)
  testSuites: TestSuite[];

  /** Associated bugs */
  @OneToMany(() => Bug, bug => bug.project)
  bugs: Bug[];
}
