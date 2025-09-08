import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Project } from '../../projects/project.entity';

/**
 * AI Assistant Entity
 * 
 * Represents an AI assistant created in OpenAI for a specific project.
 * Each project can have one assistant that handles test case generation.
 * 
 * @entity AIAssistant
 */
@Entity('ai_assistants')
export class AIAssistant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column({ name: 'assistant_id', unique: true })
  assistantId: string;

  @Column({ name: 'file_ids', type: 'text', nullable: true })
  fileIds: string;

  @Column({ type: 'text', nullable: true })
  instructions: string;

  @Column({ type: 'text', nullable: true })
  tools: string; // JSON array

  @Column({ default: 'gpt-4.1-nano' })
  model: string;

  @Column({ default: 'active' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Project, project => project.aiAssistants)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @OneToMany('AIThread', 'assistant')
  threads: any[];
} 