import { Controller, Post, Param, Get, Delete, BadRequestException, Body, Logger } from '@nestjs/common';
import { AssistantManagerService } from '../services/assistant-manager.service';
import { ThreadManagerService } from '../services/thread-manager.service';
import { AIAssistant } from '../entities/ai-assistant.entity';
import { AIThread } from '../entities/ai-thread.entity';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('ai')
@Controller('projects/:projectId/ai')
export class AIController {
  private readonly logger = new Logger(AIController.name);

  constructor(
    private readonly assistantManagerService: AssistantManagerService,
    private readonly threadManagerService: ThreadManagerService,
  ) {}

  @Get('assistant')
  async getAssistant(@Param('projectId') projectId: string): Promise<AIAssistant> {
    const assistant = await this.assistantManagerService.getAssistant(projectId);
    if (!assistant) {
      throw new BadRequestException('No existe un assistant para este proyecto. Inicializa el contexto IA primero.');
    }
    return assistant;
  }

  @Delete('assistant')
  async deleteAssistant(@Param('projectId') projectId: string): Promise<{ message: string }> {
    await this.assistantManagerService.deleteAssistant(projectId);
    return { message: 'Assistant deleted successfully' };
  }

  @Post('assistant/init')
  async initAssistant(
    @Param('projectId') projectId: string,
    @Body() dto: { assistantName?: string }
  ): Promise<{ assistantId: string; message: string }> {
    let assistant: AIAssistant | null = null;
    try {
      // 1. Obtener assistant existente o crear uno nuevo
      assistant = await this.assistantManagerService.getAssistant(projectId);
      if (!assistant) {
        this.logger.log(`🚀 No existe assistant, creando uno nuevo para proyecto ${projectId}`);
        assistant = await this.assistantManagerService.createAssistant(projectId);
      }
      
      return {
        assistantId: assistant.assistantId,
        message: 'Assistant initialized successfully. Los archivos se enviarán directamente en el prompt.',
      };
    } catch (err) {
      // Rollback: eliminar assistant si algo falla
      if (assistant) {
        await this.assistantManagerService.deleteAssistant(projectId);
      }
      throw err;
    }
  }

  @Post('thread')
  async createThread(@Param('projectId') projectId: string): Promise<AIThread> {
    // Primero obtener assistant existente
    const assistant = await this.assistantManagerService.getAssistant(projectId);
    if (!assistant) {
      throw new BadRequestException('No existe un assistant para este proyecto. Inicializa el contexto IA primero.');
    }
    
    // Obtener thread existente o crear uno nuevo
    let thread = await this.threadManagerService.getThread(projectId, assistant.assistantId);
    if (!thread) {
      thread = await this.threadManagerService.createThread(projectId, assistant.assistantId);
    }
    
    return thread;
  }

  @Get('threads/stats')
  async getThreadStats(@Param('projectId') projectId: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    totalMessages: number;
  }> {
    return await this.threadManagerService.getThreadStats(projectId);
  }

  @Delete('threads')
  async deleteAllThreads(@Param('projectId') projectId: string): Promise<{ message: string }> {
    await this.threadManagerService.deleteAllProjectThreads(projectId);
    return { message: 'All threads deleted successfully' };
  }
} 