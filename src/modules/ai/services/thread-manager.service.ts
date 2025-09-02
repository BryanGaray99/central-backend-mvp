import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import { AIThread } from '../entities/ai-thread.entity';
import { AIAssistant } from '../entities/ai-assistant.entity';
import { OpenAIConfigService } from './openai-config.service';

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
   * Configura la API key de OpenAI dinámicamente
   */
  private async configureOpenAI() {
    const apiKey = await this.openAIConfigService.getOpenAIKey();
    if (!apiKey) {
      throw new Error('OpenAI API key no configurada. Configure la API key en Settings > OpenAI Configuration.');
    }
    
    // Crear la instancia de OpenAI si no existe
    if (!this.openai) {
      this.openai = new OpenAI({ apiKey });
    } else {
      // Actualizar la instancia existente con la nueva API key
      this.openai.apiKey = apiKey;
    }
  }

  /**
   * Obtiene un thread activo para un proyecto
   */
  async getThread(projectId: string, assistantId: string): Promise<AIThread | null> {
    this.logger.log(`🔍 Buscando thread activo para proyecto ${projectId}`);

    // Configurar OpenAI antes de hacer la llamada
    await this.configureOpenAI();

    // Buscar threads activos
    const activeThreads = await this.aiThreadRepository.find({
      where: { projectId, assistantId, status: 'active' },
      order: { lastUsedAt: 'DESC' },
    });

    if (activeThreads.length === 0) {
      this.logger.log(`❌ No se encontraron threads activos para proyecto ${projectId}`);
      return null;
    }

    // Reutilizar el thread más reciente que no esté lleno
    for (const thread of activeThreads) {
      try {
        if (!this.openai) {
          throw new Error('OpenAI client not configured');
        }
        await this.openai.beta.threads.retrieve(thread.threadId);
        if (thread.messageCount < thread.maxMessages) {
          this.logger.log(`✅ Thread activo encontrado: ${thread.threadId}`);
          return thread;
        } else {
          this.logger.log(`⚠️ Thread lleno (${thread.messageCount}/${thread.maxMessages}), marcando como inactivo: ${thread.threadId}`);
          await this.deactivateThread(thread.id);
        }
      } catch (error) {
        this.logger.warn(`⚠️ Thread no encontrado en OpenAI, eliminando: ${thread.threadId}`);
        await this.aiThreadRepository.remove(thread);
      }
    }

    this.logger.log(`❌ No se encontraron threads válidos para proyecto ${projectId}`);
    return null;
  }

  /**
   * Crea un nuevo thread para un proyecto
   */
  async createThread(projectId: string, assistantId: string): Promise<AIThread> {
    this.logger.log(`🚀 Creando nuevo thread para proyecto ${projectId}`);

    // Configurar OpenAI antes de hacer la llamada
    await this.configureOpenAI();

    // Limitar a máximo 1 thread activo por proyecto/assistant (optimización de tokens)
    const allThreads = await this.aiThreadRepository.find({
      where: { projectId, assistantId },
      order: { lastUsedAt: 'DESC' },
    });
    
    if (allThreads.length >= 1) {
      // Eliminar todos los threads anteriores para evitar acumulación
      for (const oldThread of allThreads) {
        this.logger.log(`♻️ Limpiando thread anterior: ${oldThread.threadId}`);
        try {
          if (!this.openai) {
            throw new Error('OpenAI client not configured');
          }
          await this.openai.beta.threads.del(oldThread.threadId);
          this.logger.log(`🗑️ Thread eliminado de OpenAI: ${oldThread.threadId}`);
        } catch (err) {
          this.logger.warn(`⚠️ Error eliminando thread de OpenAI: ${err.message}`);
        }
        await this.aiThreadRepository.remove(oldThread);
        this.logger.log(`🗑️ Thread eliminado de BD: ${oldThread.id}`);
      }
    }

    return await this.createNewThread(projectId, assistantId);
  }

  /**
   * Crea un nuevo thread para un proyecto (método privado)
   */
  private async createNewThread(projectId: string, assistantId: string): Promise<AIThread> {
    this.logger.log(`📋 Creando thread para proyecto: ${projectId}`);

    // Crear thread en OpenAI
    if (!this.openai) {
      throw new Error('OpenAI client not configured');
    }
    const openaiThread = await this.openai.beta.threads.create();
    this.logger.log(`✅ Thread creado en OpenAI: ${openaiThread.id}`);

    // Guardar thread en BD
    const thread = new AIThread();
    thread.projectId = projectId;
    thread.threadId = openaiThread.id;
    thread.assistantId = assistantId;
    thread.status = 'active';
    thread.messageCount = 0;
    thread.maxMessages = 1000;
    thread.lastUsedAt = new Date();

    const savedThread = await this.aiThreadRepository.save(thread);
    this.logger.log(`💾 Thread guardado en BD: ${savedThread.id}`);

    return savedThread;
  }

  /**
   * Incrementa el contador de mensajes de un thread
   */
  async incrementMessageCount(threadId: string): Promise<void> {
    const thread = await this.aiThreadRepository.findOne({
      where: { threadId },
    });

    if (thread) {
      thread.messageCount += 1;
      thread.lastUsedAt = new Date();
      await this.aiThreadRepository.save(thread);
      
      this.logger.log(`📊 Thread ${threadId}: ${thread.messageCount}/${thread.maxMessages} mensajes`);
      
      // Si el thread está lleno, marcarlo como inactivo
      if (thread.messageCount >= thread.maxMessages) {
        this.logger.log(`⚠️ Thread ${threadId} lleno, marcando como inactivo`);
        await this.deactivateThread(thread.id);
      }
    }
  }

  /**
   * Marca un thread como inactivo
   */
  async deactivateThread(threadId: number): Promise<void> {
    await this.aiThreadRepository.update(threadId, {
      status: 'inactive',
    });
    this.logger.log(`🔒 Thread ${threadId} marcado como inactivo`);
  }

  /**
   * Reactiva un thread inactivo
   */
  async reactivateThread(threadId: number): Promise<void> {
    await this.aiThreadRepository.update(threadId, {
      status: 'active',
      messageCount: 0, // Resetear contador
      lastUsedAt: new Date(),
    });
    this.logger.log(`🔄 Thread ${threadId} reactivado`);
  }

  /**
   * Busca un thread inactivo para reutilizar
   */
  async findInactiveThread(projectId: string, assistantId: string): Promise<AIThread | null> {
    return await this.aiThreadRepository.findOne({
      where: { 
        projectId, 
        assistantId, 
        status: 'inactive' 
      },
      order: { lastUsedAt: 'DESC' }, // Tomar el más reciente
    });
  }

  /**
   * Obtiene estadísticas de threads de un proyecto
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
    const inactive = threads.filter(t => t.status === 'inactivo').length;
    const totalMessages = threads.reduce((sum, t) => sum + t.messageCount, 0);

    return {
      total,
      active,
      inactive,
      totalMessages,
    };
  }

  /**
   * Limpia threads antiguos (mantiene solo los últimos 3)
   */
  async cleanupOldThreads(projectId: string, assistantId: string): Promise<void> {
    const threads = await this.aiThreadRepository.find({
      where: { projectId, assistantId },
      order: { lastUsedAt: 'DESC' },
    });

    // Mantener solo los últimos 3 threads
    if (threads.length > 3) {
      const threadsToDelete = threads.slice(3);
      
      for (const thread of threadsToDelete) {
        try {
          // Eliminar de OpenAI
          if (!this.openai) {
            throw new Error('OpenAI client not configured');
          }
          await this.openai.beta.threads.del(thread.threadId);
          this.logger.log(`🗑️ Thread eliminado de OpenAI: ${thread.threadId}`);
        } catch (error) {
          this.logger.warn(`⚠️ Error eliminando thread de OpenAI: ${error.message}`);
        }

        // Eliminar de BD
        await this.aiThreadRepository.remove(thread);
        this.logger.log(`🗑️ Thread eliminado de BD: ${thread.id}`);
      }
    }
  }

  /**
   * Elimina todos los threads de un proyecto
   */
  async deleteAllProjectThreads(projectId: string): Promise<void> {
    const threads = await this.aiThreadRepository.find({
      where: { projectId },
    });

    for (const thread of threads) {
      try {
        // Eliminar de OpenAI
        if (!this.openai) {
          throw new Error('OpenAI client not configured');
        }
        await this.openai.beta.threads.del(thread.threadId);
        this.logger.log(`🗑️ Thread eliminado de OpenAI: ${thread.threadId}`);
      } catch (error) {
        this.logger.warn(`⚠️ Error eliminando thread de OpenAI: ${error.message}`);
      }

      // Eliminar de BD
      await this.aiThreadRepository.remove(thread);
      this.logger.log(`🗑️ Thread eliminado de BD: ${thread.id}`);
    }
  }
} 