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

@Entity('endpoints')
export class Endpoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column()
  section: string;

  @Column()
  entityName: string;

  @Column()
  path: string;

  @Column('json')
  methods: Array<{
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    requestBodyDefinition?: Array<{
      name: string;
      type: string;
      example?: any;
      validations?: Record<string, any>;
    }>;
    description?: string;
    requiresAuth?: boolean;
  }>;

  @Column('json', { nullable: true })
  pathParameters?: Array<{
    name: string;
    value: string | number;
  }>;

  @Column({ nullable: true })
  description?: string;

  @Column('json', { nullable: true })
  analysisResults?: Record<string, any>; // Analysis results by method

  @Column('json', { nullable: true })
  generatedArtifacts?: {
    feature?: string;
    steps?: string;
    fixture?: string;
    schema?: string;
    types?: string;
    client?: string;
  };

  @Column({ default: 'pending' })
  status: 'pending' | 'analyzing' | 'generating' | 'ready' | 'failed';

  @Column({ nullable: true })
  errorMessage?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
