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
 * Enumeration of test step statuses.
 *
 * @enum StepStatus
 * @since 1.0.0
 */
export enum StepStatus {
  /** Step is active and available for use */
  ACTIVE = 'active',
  /** Step is deprecated and should not be used */
  DEPRECATED = 'deprecated',
}

/**
 * Enumeration of Gherkin step types.
 *
 * @enum StepType
 * @since 1.0.0
 */
export enum StepType {
  /** Given step for preconditions */
  GIVEN = 'Given',
  /** When step for actions */
  WHEN = 'When',
  /** Then step for assertions */
  THEN = 'Then',
  /** And step for additional conditions */
  AND = 'And',
  /** But step for negative conditions */
  BUT = 'But',
}

/**
 * Enumeration of step template types.
 *
 * @enum StepTemplateType
 * @since 1.0.0
 */
export enum StepTemplateType {
  /** Predefined step template from the system */
  PREDEFINED = 'predefined',
  /** Builder-generated step template */
  BUILDER = 'builder',
  /** Custom user-defined step template */
  CUSTOM = 'custom',
}

/**
 * Enumeration of step reusability levels.
 *
 * @enum Reusability
 * @since 1.0.0
 */
export enum Reusability {
  /** Low reusability - specific to one entity */
  LOW = 'low',
  /** Medium reusability - usable across similar entities */
  MEDIUM = 'medium',
  /** High reusability - usable across many entities */
  HIGH = 'high',
}

/**
 * Test Step Entity
 *
 * This entity represents a reusable test step in the BDD testing system.
 * It contains the Gherkin definition, implementation code, and metadata
 * for a specific test step that can be used across multiple test cases.
 *
 * @entity TestStep
 * @table test_steps
 * @since 1.0.0
 */
@Entity('test_steps')
export class TestStep {
  /**
   * Unique identifier for the test step record.
   *
   * @example '123e4567-e89b-12d3-a456-426614174000'
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Unique step identifier for tracking and reference.
   *
   * @example 'ST-ECOMMERCE-CREATE-01'
   */
  @Column({ unique: true })
  stepId: string;

  /**
   * ID of the project this step belongs to.
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
   * Section/category for organizing the step.
   *
   * @example 'ecommerce'
   */
  @Column()
  section: string;

  /**
   * Name of the entity this step is designed for.
   *
   * @example 'Product'
   */
  @Column()
  entityName: string;

  /**
   * Human-readable name of the step.
   *
   * @example 'Create a new product'
   */
  @Column()
  name: string;

  /**
   * Gherkin step definition with placeholders.
   *
   * @example 'Given I have a valid {productName} with price {price}'
   */
  @Column('text')
  definition: string;

  /**
   * Type of Gherkin step (Given, When, Then, And, But).
   */
  @Column({
    type: 'varchar',
    length: 10,
  })
  type: StepType;

  /**
   * Type of step template.
   *
   * @default StepTemplateType.PREDEFINED
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: StepTemplateType.PREDEFINED,
  })
  stepType: StepTemplateType;

  /**
   * Array of parameters that can be passed to the step.
   *
   * @example [
   *   { name: 'productName', type: 'string', required: true },
   *   { name: 'price', type: 'number', required: true, defaultValue: 0 }
   * ]
   */
  @Column('json')
  parameters: {
    /** Parameter name */
    name: string;
    /** Parameter data type */
    type: 'string' | 'number' | 'boolean' | 'object';
    /** Whether the parameter is required */
    required: boolean;
    /** Default value for the parameter */
    defaultValue?: any;
    /** Conditional logic for the parameter */
    conditional?: any;
    /** Dynamic behavior configuration */
    dynamic?: any;
  }[];

  /**
   * Implementation code for the step.
   *
   * @example 'async function createProduct(productName, price) { ... }'
   */
  @Column('text')
  implementation: string;

  /**
   * Validation configuration for the step.
   *
   * @example {
   *   syntax: { testCode: '...', expectedResult: true, timeout: 5000 },
   *   runtime: { testCode: '...', expectedResult: 'success', timeout: 10000 }
   * }
   */
  @Column('json', { nullable: true })
  validation?: {
    /** Syntax validation configuration */
    syntax?: StepValidation;
    /** Runtime validation configuration */
    runtime?: StepValidation;
    /** Integration validation configuration */
    integration?: StepValidation;
  };

  /**
   * Current status of the test step.
   *
   * @default StepStatus.ACTIVE
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: StepStatus.ACTIVE,
  })
  status: StepStatus;

  /**
   * Additional metadata about the step.
   *
   * @example {
   *   category: 'api',
   *   complexity: 'medium',
   *   reusability: Reusability.HIGH
   * }
   */
  @Column('json', { nullable: true })
  metadata?: {
    /** Category of the step */
    category?: string;
    /** Complexity level of the step */
    complexity?: 'simple' | 'medium' | 'complex';
    /** Reusability level of the step */
    reusability?: Reusability;
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

/**
 * Interface for defining step validation configurations.
 *
 * This interface represents the structure of validation rules
 * that can be applied to test steps.
 *
 * @interface StepValidation
 * @since 1.0.0
 */
export interface StepValidation {
  /**
   * Test code to execute for validation.
   *
   * @example 'expect(response.status).toBe(200)'
   */
  testCode: string;

  /**
   * Expected result of the validation.
   *
   * @example true
   */
  expectedResult: any;

  /**
   * Timeout in milliseconds for the validation.
   *
   * @example 5000
   */
  timeout: number;
} 