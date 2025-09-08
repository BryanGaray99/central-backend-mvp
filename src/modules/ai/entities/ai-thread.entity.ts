import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Project } from '../../projects/project.entity';

/**
 * AI Thread Entity
 * 
 * Represents a conversation thread with an AI assistant for a specific project.
 * Manages the conversation history and message limits for OpenAI Assistant API.
 * 
 * @entity AIThread
 */
@Entity('ai_threads')
export class AIThread {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column({ name: 'thread_id', unique: true })
  threadId: string;

  @Column({ name: 'assistant_id' })
  assistantId: string;

  @Column({ default: 'active' })
  status: string;

  @Column({ name: 'message_count', default: 0 })
  messageCount: number;

  @Column({ name: 'max_messages', default: 1000 })
  maxMessages: number;

  @Column({ name: 'last_used_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  lastUsedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Project, project => project.aiThreads)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne('AIAssistant', 'threads')
  @JoinColumn({ name: 'assistant_id' })
  assistant: any;
} 