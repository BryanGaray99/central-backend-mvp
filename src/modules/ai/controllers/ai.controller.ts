import { Controller, Post, Param, Get, Delete, BadRequestException, Body, Logger } from '@nestjs/common';
import { AssistantManagerService } from '../services/assistant-manager.service';
import { ThreadManagerService } from '../services/thread-manager.service';
import { TestCaseSuggestionService } from '../services/test-case-suggestion.service';
import { AIAssistant } from '../entities/ai-assistant.entity';
import { TestCaseSuggestionRequestDto, TestCaseSuggestionResponseDto } from '../dto/test-case-suggestion.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

/**
 * AI Controller
 * 
 * Handles project-specific AI operations including assistant management,
 * test case generation, and AI suggestions. All endpoints are scoped to a specific project.
 * 
 * @controller AIController
 */
@ApiTags('ai')
@Controller('projects/:projectId/ai')
export class AIController {
  private readonly logger = new Logger(AIController.name);

  constructor(
    private readonly assistantManagerService: AssistantManagerService,
    private readonly threadManagerService: ThreadManagerService,
    private readonly testCaseSuggestionService: TestCaseSuggestionService,
  ) {}

  /**
   * Retrieves the AI assistant for a specific project.
   * 
   * @param projectId - The ID of the project
   * @returns Promise<AIAssistant> - The AI assistant entity
   * @throws BadRequestException - If no assistant exists for the project
   * 
   * @example
   * ```typescript
   * const assistant = await aiController.getAssistant('project-123');
   * ```
   */
  @Get('assistant')
  async getAssistant(@Param('projectId') projectId: string): Promise<AIAssistant> {
    const assistant = await this.assistantManagerService.getAssistant(projectId);
    if (!assistant) {
      throw new BadRequestException('No assistant exists for this project. Initialize the AI context first.');
    }
    return assistant;
  }

  /**
   * Deletes the AI assistant for a specific project.
   * 
   * @param projectId - The ID of the project
   * @returns Promise<object> - Success message
   * 
   * @example
   * ```typescript
   * const result = await aiController.deleteAssistant('project-123');
   * // Returns: { message: 'Assistant deleted successfully' }
   * ```
   */
  @Delete('assistant')
  async deleteAssistant(@Param('projectId') projectId: string): Promise<{ message: string }> {
    await this.assistantManagerService.deleteAssistant(projectId);
    return { message: 'Assistant deleted successfully' };
  }

  /**
   * Initializes an AI assistant for a specific project.
   * 
   * @param projectId - The ID of the project
   * @param dto - Optional assistant configuration
   * @param dto.assistantName - Optional custom name for the assistant
   * @returns Promise<object> - Assistant ID and success message
   * 
   * @example
   * ```typescript
   * const result = await aiController.initAssistant('project-123', { assistantName: 'Custom Bot' });
   * // Returns: { assistantId: 'asst_...', message: 'Assistant initialized successfully...' }
   * ```
   */
  @Post('assistant/init')
  async initAssistant(
    @Param('projectId') projectId: string,
    @Body() dto: { assistantName?: string }
  ): Promise<{ assistantId: string; message: string }> {
    let assistant: AIAssistant | null = null;
    try {
      // 1. Get existing assistant or create a new one
      assistant = await this.assistantManagerService.getAssistant(projectId);
      if (!assistant) {
        this.logger.log(`🚀 No assistant exists, creating a new one for project ${projectId}`);
        assistant = await this.assistantManagerService.createAssistant(projectId);
      }
      
      return {
        assistantId: assistant.assistantId,
        message: 'Assistant initialized successfully. Files will be sent directly in the prompt.',
      };
    } catch (err) {
      // Rollback: delete assistant if something fails
      if (assistant) {
        await this.assistantManagerService.deleteAssistant(projectId);
      }
      throw err;
    }
  }

  /**
   * Generates test case suggestions using AI based on existing feature and steps files.
   * 
   * @param projectId - The ID of the project
   * @param request - The test case suggestion request parameters
   * @returns Promise<TestCaseSuggestionResponseDto> - Generated test case suggestions
   * @throws BadRequestException - If assistant is missing or input is invalid
   * 
   * @example
   * ```typescript
   * const suggestions = await aiController.suggestTestCases('project-123', {
   *   section: 'ecommerce',
   *   entityName: 'Product',
   *   requirements: 'Test cases for product validation'
   * });
   * ```
   */
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

  /**
   * Retrieves all AI suggestions for a specific project.
   * 
   * @param projectId - The ID of the project
   * @returns Promise<object> - List of AI suggestions with metadata
   * 
   * @example
   * ```typescript
   * const suggestions = await aiController.getProjectSuggestions('project-123');
   * // Returns: { success: true, data: [...], total: 5 }
   * ```
   */
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
  
  /**
   * Retrieves a specific AI suggestion by its ID.
   * 
   * @param projectId - The ID of the project
   * @param suggestionId - The ID of the suggestion to retrieve
   * @returns Promise<object> - The AI suggestion data
   * @throws BadRequestException - If the suggestion is not found
   * 
   * @example
   * ```typescript
   * const suggestion = await aiController.getSuggestionById('project-123', 'suggestion-456');
   * // Returns: { success: true, data: { ... } }
   * ```
   */
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