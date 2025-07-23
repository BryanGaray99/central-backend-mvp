import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { AIAssistant } from '../ai/entities/ai-assistant.entity';
import { AIThread } from '../ai/entities/ai-thread.entity';

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

  @Column({ nullable: true, default: '/v1/api' })
  basePath: string;

  @Column({ type: 'varchar', default: ProjectStatus.PENDING })
  status: ProjectStatus;

  @Column({ type: 'varchar', default: ProjectType.PLAYWRIGHT_BDD })
  type: ProjectType;

  @Column({ nullable: true })
  path: string;

  // Nuevos campos para AI
  @Column({ name: 'assistant_id', nullable: true })
  assistantId: string;

  @Column({ name: 'assistant_created_at', type: 'datetime', nullable: true })
  assistantCreatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relaciones con entidades AI
  @OneToMany(() => AIAssistant, assistant => assistant.project)
  aiAssistants: AIAssistant[];

  @OneToMany(() => AIThread, thread => thread.project)
  aiThreads: AIThread[];


}
