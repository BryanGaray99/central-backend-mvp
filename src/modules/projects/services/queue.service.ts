import { Injectable, Logger } from '@nestjs/common';
import { Project } from '../project.entity';
import { GenerationService } from '../generation.service';

/**
 * Interface for queue items.
 * 
 * @interface QueueItem
 * @since 1.0.0
 */
interface QueueItem {
  /** The project to be processed */
  project: Project;
  /** Priority level (higher number = higher priority) */
  priority: number;
  /** Number of retry attempts */
  retries: number;
  /** Timestamp when the item was added to the queue */
  addedAt: Date;
}

/**
 * Service for managing project generation queue.
 * 
 * This service provides a priority-based queue system for project generation.
 * It handles queuing, processing, retry logic, and timeout management for
 * project generation operations.
 * 
 * @class QueueService
 * @since 1.0.0
 */
@Injectable()
export class QueueService {
  /** Logger instance for this service */
  private readonly logger = new Logger(QueueService.name);
  
  /** Internal queue storage */
  private readonly queue: QueueItem[] = [];
  
  /** Maximum number of retry attempts */
  private readonly maxRetries = 3;
  
  /** Timeout for generation operations in milliseconds */
  private readonly timeoutMs = 5 * 60 * 1000;
  
  /** Flag indicating if the queue is currently being processed */
  private isProcessing = false;

  /**
   * Creates an instance of QueueService.
   * 
   * @param generationService - Service for project generation
   */
  constructor(private readonly generationService: GenerationService) {}

  /**
   * Adds a project to the generation queue.
   * 
   * Projects are inserted based on priority (higher priority first).
   * If the queue is not currently being processed, processing will start automatically.
   * 
   * @param project - The project to add to the queue
   * @param priority - Priority level (higher number = higher priority)
   * 
   * @example
   * ```typescript
   * const project = await projectRepo.findOne({ where: { id: 'project-id' } });
   * queueService.enqueue(project, 2); // High priority
   * ```
   */
  enqueue(project: Project, priority: number = 1): void {
    const queueItem: QueueItem = {
      project,
      priority,
      retries: 0,
      addedAt: new Date(),
    };

    // Insert based on priority (higher priority first)
    const insertIndex = this.queue.findIndex(
      (item) => item.priority < priority,
    );
    if (insertIndex === -1) {
      this.queue.push(queueItem);
    } else {
      this.queue.splice(insertIndex, 0, queueItem);
    }

    this.logger.log(
      `Project ${project.name} added to queue with priority ${priority}`,
    );

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Processes the queue sequentially.
   * 
   * This method processes all items in the queue one by one, handling
   * errors gracefully and maintaining the processing state.
   * 
   * @returns Promise that resolves when queue processing is complete
   * @private
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.logger.log(
      `Starting queue processing with ${this.queue.length} items`,
    );

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
   * Processes a single queue item.
   * 
   * This method handles the generation of a single project with timeout
   * and retry logic. If generation fails, it will retry up to the maximum
   * number of attempts with decreasing priority.
   * 
   * @param item - The queue item to process
   * @returns Promise that resolves when processing is complete
   * @private
   */
  private async processItem(item: QueueItem): Promise<void> {
    this.logger.log(
      `Processing project ${item.project.name} (attempt ${item.retries + 1}/${this.maxRetries + 1})`,
    );

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error('Timeout: Generation exceeded time limit')),
          this.timeoutMs,
        );
      });

      // Create the generation promise
      const generationPromise = this.generationService.generateProject(
        item.project,
      );

      // Race between generation and timeout
      await Promise.race([generationPromise, timeoutPromise]);

      this.logger.log(`Project ${item.project.name} generated successfully`);
    } catch (error) {
      this.logger.error(
        `Error generating project ${item.project.name}: ${error.message}`,
      );

      // Retry logic
      if (item.retries < this.maxRetries) {
        item.retries++;
        this.logger.log(
          `Retrying project ${item.project.name} (attempt ${item.retries + 1}/${this.maxRetries + 1})`,
        );

        // Add back to queue with lower priority
        this.enqueue(item.project, Math.max(1, item.priority - 1));
      } else {
        this.logger.error(
          `Project ${item.project.name} failed after ${this.maxRetries} attempts`,
        );
      }
    }
  }

  /**
   * Gets the current status of the queue.
   * 
   * @returns Object containing queue status information
   * 
   * @example
   * ```typescript
   * const status = queueService.getQueueStatus();
   * console.log(`Queue has ${status.queueLength} items`);
   * console.log(`Processing: ${status.isProcessing}`);
   * ```
   */
  getQueueStatus(): {
    /** Whether the queue is currently being processed */
    isProcessing: boolean;
    /** Number of items in the queue */
    queueLength: number;
    /** Array of queue items with their details */
    items: Array<{
      /** Name of the project */
      projectName: string;
      /** Priority level */
      priority: number;
      /** Number of retry attempts */
      retries: number;
      /** When the item was added to the queue */
      addedAt: Date;
    }>;
  } {
    return {
      isProcessing: this.isProcessing,
      queueLength: this.queue.length,
      items: this.queue.map((item) => ({
        projectName: item.project.name,
        priority: item.priority,
        retries: item.retries,
        addedAt: item.addedAt,
      })),
    };
  }

  /**
   * Clears all items from the queue.
   * 
   * @example
   * ```typescript
   * queueService.clearQueue();
   * console.log('Queue has been cleared');
   * ```
   */
  clearQueue(): void {
    this.queue.length = 0;
    this.logger.log('Queue cleared');
  }
}
