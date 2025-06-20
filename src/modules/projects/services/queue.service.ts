import { Injectable, Logger } from '@nestjs/common';
import { Project, ProjectStatus } from '../project.entity';
import { GenerationService } from '../generation.service';

interface QueueItem {
  projectId: string;
  project: Project;
  priority: number;
  createdAt: Date;
  retryCount: number;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly queue: QueueItem[] = [];
  private readonly processing = new Set<string>();
  private readonly maxRetries = 3;
  private readonly maxConcurrent = 2; // Máximo 2 proyectos procesándose simultáneamente
  private readonly timeoutMs = 5 * 60 * 1000; // 5 minutos
  private isProcessing = false;

  constructor(private readonly generationService: GenerationService) {}

  /**
   * Agrega un proyecto a la cola de generación
   */
  async enqueue(project: Project, priority: number = 1): Promise<void> {
    const queueItem: QueueItem = {
      projectId: project.id,
      project,
      priority,
      createdAt: new Date(),
      retryCount: 0,
    };

    // Insertar en la cola ordenada por prioridad (mayor prioridad primero)
    const insertIndex = this.queue.findIndex(item => item.priority < priority);
    if (insertIndex === -1) {
      this.queue.push(queueItem);
    } else {
      this.queue.splice(insertIndex, 0, queueItem);
    }

    this.logger.log(`Proyecto ${project.name} agregado a la cola (prioridad: ${priority})`);
    
    // Iniciar procesamiento si no está activo
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Procesa la cola de generación
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.logger.log('Iniciando procesamiento de cola de generación');

    while (this.queue.length > 0 && this.processing.size < this.maxConcurrent) {
      const item = this.queue.shift();
      if (!item) break;

      // Verificar si el proyecto ya está siendo procesado
      if (this.processing.has(item.projectId)) {
        this.queue.unshift(item); // Devolver al inicio de la cola
        continue;
      }

      // Procesar el proyecto
      this.processProject(item);
    }

    this.isProcessing = false;
    
    // Si quedan items en la cola, continuar procesando
    if (this.queue.length > 0) {
      setTimeout(() => this.processQueue(), 1000);
    }
  }

  /**
   * Procesa un proyecto individual
   */
  private async processProject(item: QueueItem): Promise<void> {
    this.processing.add(item.projectId);
    
    this.logger.log(`Procesando proyecto ${item.project.name} (intento ${item.retryCount + 1})`);

    try {
      // Configurar timeout para la generación
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout: La generación excedió el tiempo límite')), this.timeoutMs);
      });

      // Ejecutar generación con timeout
      await Promise.race([
        this.generationService.generateProject(item.project),
        timeoutPromise
      ]);

      this.logger.log(`Proyecto ${item.project.name} generado exitosamente`);
      
    } catch (error) {
      this.logger.error(`Error generando proyecto ${item.project.name}: ${error.message}`);
      
      // Manejar reintentos
      if (item.retryCount < this.maxRetries) {
        item.retryCount++;
        item.createdAt = new Date();
        
        // Reinsertar en la cola con menor prioridad
        this.queue.push(item);
        this.logger.log(`Proyecto ${item.project.name} reencolado para reintento ${item.retryCount}`);
      } else {
        this.logger.error(`Proyecto ${item.project.name} falló después de ${this.maxRetries} intentos`);
      }
    } finally {
      this.processing.delete(item.projectId);
      
      // Continuar procesando la cola
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 1000);
      }
    }
  }

  /**
   * Obtiene el estado de la cola
   */
  getQueueStatus(): {
    queueLength: number;
    processingCount: number;
    isProcessing: boolean;
  } {
    return {
      queueLength: this.queue.length,
      processingCount: this.processing.size,
      isProcessing: this.isProcessing,
    };
  }

  /**
   * Obtiene información detallada de la cola
   */
  getQueueDetails(): {
    queue: Array<{
      projectId: string;
      projectName: string;
      priority: number;
      createdAt: Date;
      retryCount: number;
    }>;
    processing: string[];
  } {
    return {
      queue: this.queue.map(item => ({
        projectId: item.projectId,
        projectName: item.project.name,
        priority: item.priority,
        createdAt: item.createdAt,
        retryCount: item.retryCount,
      })),
      processing: Array.from(this.processing),
    };
  }

  /**
   * Limpia la cola (útil para testing o emergencias)
   */
  clearQueue(): void {
    this.queue.length = 0;
    this.logger.warn('Cola de generación limpiada');
  }
}
