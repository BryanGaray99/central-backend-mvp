import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

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

  @Column()
  baseUrl: string;

  @Column({ type: 'varchar', default: ProjectStatus.PENDING })
  status: ProjectStatus;

  @Column({ type: 'varchar', default: ProjectType.PLAYWRIGHT_BDD })
  type: ProjectType;

  @Column({ nullable: true })
  path: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
