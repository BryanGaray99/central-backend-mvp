import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from '../projects/project.entity';

/**
 * Endpoint entity representing an API endpoint for testing.
 * 
 * This entity stores information about API endpoints that have been registered
 * for analysis and test generation. It includes endpoint configuration,
 * analysis results, and generated testing artifacts.
 * 
 * @entity Endpoint
 * @table endpoints
 * @since 1.0.0
 */
@Entity('endpoints')
export class Endpoint {
  /** Unique identifier for the endpoint */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Descriptive name for the endpoint */
  @Column()
  name: string;

  /** ID of the project this endpoint belongs to */
  @Column()
  projectId: string;

  /** Project this endpoint belongs to */
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  /** Section or module this endpoint belongs to */
  @Column()
  section: string;

  /** Name of the entity this endpoint manages */
  @Column()
  entityName: string;

  /** API path for this endpoint */
  @Column()
  path: string;

  /** HTTP methods supported by this endpoint with their configurations */
  @Column('json')
  methods: Array<{
    /** HTTP method (GET, POST, PUT, PATCH, DELETE) */
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    /** Request body definition for methods that require it */
    requestBodyDefinition?: Array<{
      /** Field name */
      name: string;
      /** Field type */
      type: string;
      /** Example value for the field */
      example?: any;
      /** Validation rules for the field */
      validations?: Record<string, any>;
    }>;
    /** Description of the method */
    description?: string;
    /** Whether this method requires authentication */
    requiresAuth?: boolean;
  }>;

  /** Path parameters for this endpoint */
  @Column('json', { nullable: true })
  pathParameters?: Array<{
    /** Parameter name */
    name: string;
    /** Parameter value */
    value: string | number;
  }>;

  /** General description of the endpoint */
  @Column({ nullable: true })
  description?: string;

  /** Analysis results by HTTP method */
  @Column('json', { nullable: true })
  analysisResults?: Record<string, any>;

  /** Information about generated testing artifacts */
  @Column('json', { nullable: true })
  generatedArtifacts?: {
    /** Path to the generated feature file */
    feature?: string;
    /** Path to the generated steps file */
    steps?: string;
    /** Path to the generated fixture file */
    fixture?: string;
    /** Path to the generated schema file */
    schema?: string;
    /** Path to the generated types file */
    types?: string;
    /** Path to the generated client file */
    client?: string;
  };

  /** Current status of the endpoint processing */
  @Column({ default: 'pending' })
  status: 'pending' | 'analyzing' | 'generating' | 'ready' | 'failed';

  /** Error message if processing failed */
  @Column({ nullable: true })
  errorMessage?: string;

  /** Timestamp when the endpoint was created */
  @CreateDateColumn()
  createdAt: Date;

  /** Timestamp when the endpoint was last updated */
  @UpdateDateColumn()
  updatedAt: Date;
}
