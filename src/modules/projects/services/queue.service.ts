import { Injectable, Logger } from '@nestjs/common';
import { Project } from '../project.entity';
import { GenerationService } from '../generation.service';

interface QueueItem {
  project: Project;
  priority: number;
  retries: number;
  addedAt: Date;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly queue: QueueItem[] = [];
  private readonly maxRetries = 3;
  private readonly timeoutMs = 5 * 60 * 1000; // 5 minutes
  private isProcessing = false;

  constructor(private readonly generationService: GenerationService) {}

  /**
   * Add a project to the generation queue
   */
  enqueue(project: Project, priority: number = 1): void {
    const queueItem: QueueItem = {
      project,
      priority,
      retries: 0,
      addedAt: new Date(),
    };

    // Insert based on priority (higher priority first)
    const insertIndex = this.queue.findIndex(item => item.priority < priority);
    if (insertIndex === -1) {
      this.queue.push(queueItem);
    } else {
      this.queue.splice(insertIndex, 0, queueItem);
    }

    this.logger.log(`Project ${project.name} added to queue with priority ${priority}`);
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    this.logger.log(`Starting queue processing with ${this.queue.length} items`);

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) continue;

      try {
        await this.processItem(item);
      } catch (error) {
        this.logger.error(`Error processing queue item: ${error.message}`);
      }
    }

    this.isProcessing = false;
    this.logger.log('Queue processing completed');
  }

  /**
   * Process a single queue item
   */
  private async processItem(item: QueueItem): Promise<void> {
    this.logger.log(`Processing project ${item.project.name} (attempt ${item.retries + 1}/${this.maxRetries + 1})`);

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout: Generation exceeded time limit')), this.timeoutMs);
      });

      // Create the generation promise
      const generationPromise = this.generationService.generateProject(item.project);

      // Race between generation and timeout
      await Promise.race([generationPromise, timeoutPromise]);

      this.logger.log(`Project ${item.project.name} generated successfully`);
      
    } catch (error) {
      this.logger.error(`Error generating project ${item.project.name}: ${error.message}`);

      // Retry logic
      if (item.retries < this.maxRetries) {
        item.retries++;
        this.logger.log(`Retrying project ${item.project.name} (attempt ${item.retries + 1}/${this.maxRetries + 1})`);
        
        // Add back to queue with lower priority
        this.enqueue(item.project, Math.max(1, item.priority - 1));
      } else {
        this.logger.error(`Project ${item.project.name} failed after ${this.maxRetries} attempts`);
      }
    }
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    isProcessing: boolean;
    queueLength: number;
    items: Array<{
      projectName: string;
      priority: number;
      retries: number;
      addedAt: Date;
    }>;
  } {
    return {
      isProcessing: this.isProcessing,
      queueLength: this.queue.length,
      items: this.queue.map(item => ({
        projectName: item.project.name,
        priority: item.priority,
        retries: item.retries,
        addedAt: item.addedAt,
      })),
    };
  }

  /**
   * Clear the queue
   */
  clearQueue(): void {
    this.queue.length = 0;
    this.logger.log('Queue cleared');
  }
}
