import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Project } from '../../projects/project.entity';
import { TestCaseSuggestionDto } from '../dto/test-case-suggestion.dto';

/**
 * AI Suggestion Entity
 * 
 * Represents AI-generated test case suggestions for a specific project and entity.
 * Stores the suggestions, metadata, and processing information.
 * 
 * @entity AISuggestion
 */
@Entity('ai_suggestions')
export class AISuggestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  suggestionId: string;

  @Column()
  projectId: string;

  @Column()
  entityName: string;

  @Column()
  section: string;

  @Column({ type: 'text' })
  requirements: string;

  @Column({ type: 'json' })
  suggestions: TestCaseSuggestionDto[];

  @Column({ default: 0 })
  totalSuggestions: number;

  @Column({ nullable: true })
  assistantId: string;

  @Column({ nullable: true })
  threadId: string;

  @Column({ nullable: true })
  runId: string;

  @Column({ nullable: true })
  processingTime: number;

  @Column({ default: 'completed' })
  status: string;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'json', nullable: true })
  metadata: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Project, project => project.aiSuggestions)
  @JoinColumn({ name: 'projectId' })
  project: Project;
}
