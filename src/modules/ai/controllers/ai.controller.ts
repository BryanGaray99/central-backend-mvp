import { Controller, Post, Param, Get, Delete, BadRequestException, Body, Logger } from '@nestjs/common';
import { AssistantManagerService } from '../services/assistant-manager.service';
import { ThreadManagerService } from '../services/thread-manager.service';
import { TestCaseSuggestionService } from '../services/test-case-suggestion.service';
import { AIAssistant } from '../entities/ai-assistant.entity';
import { TestCaseSuggestionRequestDto, TestCaseSuggestionResponseDto } from '../dto/test-case-suggestion.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('ai')
@Controller('projects/:projectId/ai')
export class AIController {
  private readonly logger = new Logger(AIController.name);

  constructor(
    private readonly assistantManagerService: AssistantManagerService,
    private readonly threadManagerService: ThreadManagerService,
    private readonly testCaseSuggestionService: TestCaseSuggestionService,
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

  @Post('test-cases/suggest')
  @ApiOperation({
    summary: 'Generate test case suggestions using AI',
    description: 'Generates 5 test case suggestions based on existing feature and steps files, avoiding duplicates'
  })
  @ApiResponse({
    status: 200,
    description: 'Test case suggestions generated successfully',
    type: TestCaseSuggestionResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - missing assistant or invalid input'
  })
  async suggestTestCases(
    @Param('projectId') projectId: string,
    @Body() request: TestCaseSuggestionRequestDto
  ): Promise<TestCaseSuggestionResponseDto> {
    this.logger.log(`🚀 Generating test case suggestions for project ${projectId}, entity: ${request.entityName}`);
    
    try {
      const suggestions = await this.testCaseSuggestionService.generateSuggestions(projectId, request);
      
      return {
        suggestions,
        totalSuggestions: suggestions.length,
        message: 'Test case suggestions generated successfully'
      };
    } catch (error) {
      this.logger.error(`❌ Error generating test case suggestions: ${error.message}`);
      throw new BadRequestException(error.message);
    }
  }

  @Get('suggestions')
  @ApiOperation({
    summary: 'Get all AI suggestions for a project',
    description: 'Retrieves all saved AI suggestions for the specified project'
  })
  async getProjectSuggestions(@Param('projectId') projectId: string) {
    const suggestions = await this.testCaseSuggestionService.getProjectSuggestions(projectId);
    return {
      success: true,
      data: suggestions,
      total: suggestions.length
    };
  }

  @Get('suggestions/stats')
  @ApiOperation({
    summary: 'Get AI suggestions statistics for a project',
    description: 'Retrieves statistics about AI suggestions for the specified project'
  })
  async getSuggestionStats(@Param('projectId') projectId: string) {
    const stats = await this.testCaseSuggestionService.getSuggestionStats(projectId);
    return {
      success: true,
      data: stats
    };
  }

  @Get('suggestions/:suggestionId')
  @ApiOperation({
    summary: 'Get a specific AI suggestion by ID',
    description: 'Retrieves a specific AI suggestion by its ID'
  })
  async getSuggestionById(@Param('projectId') projectId: string, @Param('suggestionId') suggestionId: string) {
    const suggestion = await this.testCaseSuggestionService.getSuggestionById(suggestionId);
    if (!suggestion) {
      throw new BadRequestException('Suggestion not found');
    }
    return {
      success: true,
      data: suggestion
    };
  }
} 