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

/**
 * Enumeration of AI generation statuses.
 *
 * @enum AIGenerationStatus
 * @since 1.0.0
 */
export enum AIGenerationStatus {
  /** Generation request is pending processing */
  PENDING = 'pending',
  /** Generation is currently being processed */
  PROCESSING = 'processing',
  /** Generation has completed successfully */
  COMPLETED = 'completed',
  /** Generation failed with an error */
  FAILED = 'failed',
}

/**
 * Enumeration of AI generation types.
 *
 * @enum AIGenerationType
 * @since 1.0.0
 */
export enum AIGenerationType {
  /** BDD test case generation */
  BDD_TEST_CASE = 'bdd-test-case',
  /** Test refinement and improvement */
  TEST_REFINEMENT = 'test-refinement',
  /** Code validation and verification */
  CODE_VALIDATION = 'code-validation',
}

/**
 * AI Generation Entity
 *
 * This entity represents AI-powered generation requests and their results.
 * It tracks the status, metadata, and outcomes of AI generation processes
 * for test cases, code validation, and other automated tasks.
 *
 * @entity AIGeneration
 * @table ai_generations
 * @since 1.0.0
 */
@Entity('ai_generations')
export class AIGeneration {
  /**
   * Unique identifier for the AI generation record.
   *
   * @example '123e4567-e89b-12d3-a456-426614174000'
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Unique generation identifier for tracking and reference.
   *
   * @example 'AI-GEN-20241215-001'
   */
  @Column({ unique: true })
  generationId: string;

  /**
   * ID of the project this generation belongs to.
   *
   * @example 'project-123'
   */
  @Column()
  projectId: string;

  /**
   * Project relationship.
   *
   * @relation ManyToOne
   */
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  /**
   * Type of AI generation being performed.
   *
   * @default AIGenerationType.BDD_TEST_CASE
   */
  @Column({
    type: 'varchar',
    length: 50,
    default: AIGenerationType.BDD_TEST_CASE,
  })
  type: AIGenerationType;

  /**
   * Name of the entity being generated for.
   *
   * @example 'Product'
   */
  @Column()
  entityName: string;

  /**
   * HTTP method being tested.
   *
   * @example 'POST'
   */
  @Column()
  method: string;

  /**
   * Name of the test scenario being generated.
   *
   * @example 'Create a new product with valid data'
   */
  @Column()
  scenarioName: string;

  /**
   * Section/category for organizing the generation.
   *
   * @default 'ecommerce'
   * @example 'ecommerce'
   */
  @Column({ default: 'ecommerce' })
  section: string;

  /**
   * Current status of the AI generation process.
   *
   * @default AIGenerationStatus.PENDING
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: AIGenerationStatus.PENDING,
  })
  status: AIGenerationStatus;

  /**
   * JSON string containing the original request data.
   *
   * @example '{"entityName": "Product", "method": "POST", "scenario": "Create product"}'
   */
  @Column('text', { nullable: true })
  requestData?: string;

  /**
   * Generated code content from AI processing.
   *
   * @example 'Given I have a valid product data\nWhen I send a POST request...'
   */
  @Column('text', { nullable: true })
  generatedCode?: string;

  /**
   * Error message if generation failed.
   *
   * @example 'AI service timeout'
   */
  @Column('text', { nullable: true })
  errorMessage?: string;

  /**
   * Additional metadata about the generation process.
   *
   * @example {
   *   modelUsed: 'gpt-4',
   *   processingTime: 1500,
   *   tokensUsed: 2500,
   *   filesModified: ['features/product.feature'],
   *   newScenarios: ['Create product', 'Update product']
   * }
   */
  @Column('json', { nullable: true })
  metadata?: {
    /** AI model used for generation */
    modelUsed?: string;
    /** Processing time in milliseconds */
    processingTime?: number;
    /** Number of tokens consumed */
    tokensUsed?: number;
    /** List of files modified during generation */
    filesModified?: string[];
    /** List of new scenarios created */
    newScenarios?: string[];
  };

  /**
   * Timestamp when the record was created.
   */
  @CreateDateColumn()
  createdAt: Date;

  /**
   * Timestamp when the record was last updated.
   */
  @UpdateDateColumn()
  updatedAt: Date;
} 