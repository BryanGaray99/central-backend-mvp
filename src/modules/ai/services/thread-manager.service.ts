import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import { AIThread } from '../entities/ai-thread.entity';
import { AIAssistant } from '../entities/ai-assistant.entity';
import { OpenAIConfigService } from './openai-config.service';

/**
 * Thread Manager Service
 * 
 * Manages AI conversation threads for OpenAI Assistant API interactions.
 * Handles thread creation, lifecycle management, message counting, and cleanup
 * to optimize token usage and maintain conversation context.
 * 
 * @service ThreadManagerService
 */
@Injectable()
export class ThreadManagerService {
  private readonly logger = new Logger(ThreadManagerService.name);
  private openai: OpenAI | null = null;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(AIThread)
    private readonly aiThreadRepository: Repository<AIThread>,
    @InjectRepository(AIAssistant)
    private readonly aiAssistantRepository: Repository<AIAssistant>,
    private readonly openAIConfigService: OpenAIConfigService,
  ) {}

  /**
   * Configures the OpenAI API key dynamically.
   * 
   * @private
   * @throws Error - If API key is not configured
   */
  private async configureOpenAI() {
    const apiKey = await this.openAIConfigService.getOpenAIKey();
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Configure the API key in Settings > OpenAI Configuration.');
    }
    
    // Create OpenAI instance if it doesn't exist
    if (!this.openai) {
      this.openai = new OpenAI({ apiKey });
    } else {
      // Update existing instance with new API key
      this.openai.apiKey = apiKey;
    }
  }

  /**
   * Gets an active thread for a project.
   * 
   * @param projectId - The project ID
   * @param assistantId - The assistant ID
   * @returns Promise<AIThread | null> - The active thread or null if not found
   * 
   * @example
   * ```typescript
   * const thread = await threadManagerService.getThread('project-123', 'assistant-456');
   * if (thread) {
   *   console.log(`Found active thread: ${thread.threadId}`);
   * }
   * ```
   */
  async getThread(projectId: string, assistantId: string): Promise<AIThread | null> {
    this.logger.log(`🔍 Searching for active thread for project ${projectId}`);

    // Configure OpenAI before making the call
    await this.configureOpenAI();

    // Search for active threads
    const activeThreads = await this.aiThreadRepository.find({
      where: { projectId, assistantId, status: 'active' },
      order: { lastUsedAt: 'DESC' },
    });

    if (activeThreads.length === 0) {
      this.logger.log(`❌ No active threads found for project ${projectId}`);
      return null;
    }

    // Reuse the most recent thread that is not full
    for (const thread of activeThreads) {
      try {
        if (!this.openai) {
          throw new Error('OpenAI client not configured');
        }
        await this.openai.beta.threads.retrieve(thread.threadId);
        if (thread.messageCount < thread.maxMessages) {
          this.logger.log(`✅ Active thread found: ${thread.threadId}`);
          return thread;
        } else {
          this.logger.log(`⚠️ Thread full (${thread.messageCount}/${thread.maxMessages}), marking as inactive: ${thread.threadId}`);
          await this.deactivateThread(thread.id);
        }
      } catch (error) {
        this.logger.warn(`⚠️ Thread not found in OpenAI, removing: ${thread.threadId}`);
        await this.aiThreadRepository.remove(thread);
      }
    }

    this.logger.log(`❌ No valid threads found for project ${projectId}`);
    return null;
  }

  /**
   * Creates a new thread for a project.
   * 
   * @param projectId - The project ID
   * @param assistantId - The assistant ID
   * @returns Promise<AIThread> - The created thread
   * 
   * @example
   * ```typescript
   * const thread = await threadManagerService.createThread('project-123', 'assistant-456');
   * console.log(`Created thread: ${thread.threadId}`);
   * ```
   */
  async createThread(projectId: string, assistantId: string): Promise<AIThread> {
    this.logger.log(`🚀 Creating new thread for project ${projectId}`);

    // Configure OpenAI before making the call
    await this.configureOpenAI();

    // Limit to maximum 1 active thread per project/assistant (token optimization)
    const allThreads = await this.aiThreadRepository.find({
      where: { projectId, assistantId },
      order: { lastUsedAt: 'DESC' },
    });
    
    if (allThreads.length >= 1) {
      // Remove all previous threads to avoid accumulation
      for (const oldThread of allThreads) {
        this.logger.log(`♻️ Cleaning up previous thread: ${oldThread.threadId}`);
        try {
          if (!this.openai) {
            throw new Error('OpenAI client not configured');
          }
          await this.openai.beta.threads.del(oldThread.threadId);
          this.logger.log(`🗑️ Thread deleted from OpenAI: ${oldThread.threadId}`);
        } catch (err) {
          this.logger.warn(`⚠️ Error deleting thread from OpenAI: ${err.message}`);
        }
        await this.aiThreadRepository.remove(oldThread);
        this.logger.log(`🗑️ Thread deleted from database: ${oldThread.id}`);
      }
    }

    return await this.createNewThread(projectId, assistantId);
  }

  /**
   * Creates a new thread for a project (private method).
   * 
   * @private
   * @param projectId - The project ID
   * @param assistantId - The assistant ID
   * @returns Promise<AIThread> - The created thread
   * @throws Error - If OpenAI client is not configured
   */
  private async createNewThread(projectId: string, assistantId: string): Promise<AIThread> {
    this.logger.log(`📋 Creating thread for project: ${projectId}`);

    // Create thread in OpenAI
    if (!this.openai) {
      throw new Error('OpenAI client not configured');
    }
    const openaiThread = await this.openai.beta.threads.create();
    this.logger.log(`✅ Thread created in OpenAI: ${openaiThread.id}`);

    // Save thread to database
    const thread = new AIThread();
    thread.projectId = projectId;
    thread.threadId = openaiThread.id;
    thread.assistantId = assistantId;
    thread.status = 'active';
    thread.messageCount = 0;
    thread.maxMessages = 1000;
    thread.lastUsedAt = new Date();

    const savedThread = await this.aiThreadRepository.save(thread);
    this.logger.log(`💾 Thread saved to database: ${savedThread.id}`);

    return savedThread;
  }

  /**
   * Increments the message counter of a thread.
   * 
   * @param threadId - The thread ID
   * @returns Promise<void>
   * 
   * @example
   * ```typescript
   * await threadManagerService.incrementMessageCount('thread-123');
   * ```
   */
  async incrementMessageCount(threadId: string): Promise<void> {
    const thread = await this.aiThreadRepository.findOne({
      where: { threadId },
    });

    if (thread) {
      thread.messageCount += 1;
      thread.lastUsedAt = new Date();
      await this.aiThreadRepository.save(thread);
      
      this.logger.log(`📊 Thread ${threadId}: ${thread.messageCount}/${thread.maxMessages} messages`);
      
      // If thread is full, mark as inactive
      if (thread.messageCount >= thread.maxMessages) {
        this.logger.log(`⚠️ Thread ${threadId} full, marking as inactive`);
        await this.deactivateThread(thread.id);
      }
    }
  }

  /**
   * Marks a thread as inactive.
   * 
   * @param threadId - The thread ID (database ID)
   * @returns Promise<void>
   * 
   * @example
   * ```typescript
   * await threadManagerService.deactivateThread(123);
   * ```
   */
  async deactivateThread(threadId: number): Promise<void> {
    await this.aiThreadRepository.update(threadId, {
      status: 'inactive',
    });
    this.logger.log(`🔒 Thread ${threadId} marked as inactive`);
  }

  /**
   * Reactivates an inactive thread.
   * 
   * @param threadId - The thread ID (database ID)
   * @returns Promise<void>
   * 
   * @example
   * ```typescript
   * await threadManagerService.reactivateThread(123);
   * ```
   */
  async reactivateThread(threadId: number): Promise<void> {
    await this.aiThreadRepository.update(threadId, {
      status: 'active',
      messageCount: 0, // Reset counter
      lastUsedAt: new Date(),
    });
    this.logger.log(`🔄 Thread ${threadId} reactivated`);
  }

  /**
   * Finds an inactive thread for reuse.
   * 
   * @param projectId - The project ID
   * @param assistantId - The assistant ID
   * @returns Promise<AIThread | null> - The inactive thread or null if not found
   * 
   * @example
   * ```typescript
   * const thread = await threadManagerService.findInactiveThread('project-123', 'assistant-456');
   * if (thread) {
   *   console.log(`Found inactive thread: ${thread.threadId}`);
   * }
   * ```
   */
  async findInactiveThread(projectId: string, assistantId: string): Promise<AIThread | null> {
    return await this.aiThreadRepository.findOne({
      where: { 
        projectId, 
        assistantId, 
        status: 'inactive' 
      },
      order: { lastUsedAt: 'DESC' }, // Take the most recent
    });
  }

  /**
   * Gets thread statistics for a project.
   * 
   * @param projectId - The project ID
   * @returns Promise<object> - Statistics object with thread counts and totals
   * 
   * @example
   * ```typescript
   * const stats = await threadManagerService.getThreadStats('project-123');
   * console.log(`Total threads: ${stats.total}, Active: ${stats.active}`);
   * ```
   */
  async getThreadStats(projectId: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    totalMessages: number;
  }> {
    const threads = await this.aiThreadRepository.find({
      where: { projectId },
    });

    const total = threads.length;
    const active = threads.filter(t => t.status === 'active').length;
    const inactive = threads.filter(t => t.status === 'inactive').length;
    const totalMessages = threads.reduce((sum, t) => sum + t.messageCount, 0);

    return {
      total,
      active,
      inactive,
      totalMessages,
    };
  }

  /**
   * Cleans up old threads (keeps only the last 3).
   * 
   * @param projectId - The project ID
   * @param assistantId - The assistant ID
   * @returns Promise<void>
   * 
   * @example
   * ```typescript
   * await threadManagerService.cleanupOldThreads('project-123', 'assistant-456');
   * ```
   */
  async cleanupOldThreads(projectId: string, assistantId: string): Promise<void> {
    const threads = await this.aiThreadRepository.find({
      where: { projectId, assistantId },
      order: { lastUsedAt: 'DESC' },
    });

    // Keep only the last 3 threads
    if (threads.length > 3) {
      const threadsToDelete = threads.slice(3);
      
      for (const thread of threadsToDelete) {
        try {
          // Delete from OpenAI
          if (!this.openai) {
            throw new Error('OpenAI client not configured');
          }
          await this.openai.beta.threads.del(thread.threadId);
          this.logger.log(`🗑️ Thread deleted from OpenAI: ${thread.threadId}`);
        } catch (error) {
          this.logger.warn(`⚠️ Error deleting thread from OpenAI: ${error.message}`);
        }

        // Delete from database
        await this.aiThreadRepository.remove(thread);
        this.logger.log(`🗑️ Thread deleted from database: ${thread.id}`);
      }
    }
  }

  /**
   * Deletes all threads for a project.
   * 
   * @param projectId - The project ID
   * @returns Promise<void>
   * 
   * @example
   * ```typescript
   * await threadManagerService.deleteAllProjectThreads('project-123');
   * ```
   */
  async deleteAllProjectThreads(projectId: string): Promise<void> {
    const threads = await this.aiThreadRepository.find({
      where: { projectId },
    });

    for (const thread of threads) {
      try {
        // Delete from OpenAI
        if (!this.openai) {
          throw new Error('OpenAI client not configured');
        }
        await this.openai.beta.threads.del(thread.threadId);
        this.logger.log(`🗑️ Thread deleted from OpenAI: ${thread.threadId}`);
      } catch (error) {
        this.logger.warn(`⚠️ Error deleting thread from OpenAI: ${error.message}`);
      }

      // Delete from database
      await this.aiThreadRepository.remove(thread);
      this.logger.log(`🗑️ Thread deleted from database: ${thread.id}`);
    }
  }
} 