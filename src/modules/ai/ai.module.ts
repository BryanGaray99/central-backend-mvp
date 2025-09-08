import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestCaseGenerationService } from './services/test-case-generation.service';
import { TestCaseSuggestionService } from './services/test-case-suggestion.service';
import { AssistantManagerService } from './services/assistant-manager.service';
import { ThreadManagerService } from './services/thread-manager.service';
import { OpenAIConfigService } from './services/openai-config.service';
import { AIGenerationService } from './services/ai-generation.service';
import { AIController } from './controllers/ai.controller';
import { AIGeneralController } from './controllers/ai-general.controller';
import { Project } from '../projects/project.entity';
import { CodeManipulationModule } from '../../common/services/code-manipulation/code-manipulation.module';
import { AIAssistant, AIThread, AISuggestion } from './entities';
import { AIGeneration } from '../test-cases/entities/ai-generation.entity';
import { Endpoint } from '../endpoints/endpoint.entity';
import { ConfigService } from '@nestjs/config';
import { TestCasesModule } from '../test-cases/test-cases.module';

/**
 * AI Module
 * 
 * Provides AI-powered test case generation and suggestion services using OpenAI's Assistant API.
 * This module handles assistant management, thread management, and AI generation workflows.
 * 
 * @module AIModule
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Project, AIAssistant, AIThread, AISuggestion, AIGeneration, Endpoint]),
    CodeManipulationModule,
    forwardRef(() => TestCasesModule),
  ],
  controllers: [AIController, AIGeneralController],
  providers: [
    TestCaseGenerationService,
    TestCaseSuggestionService,
    AssistantManagerService,
    ThreadManagerService,
    OpenAIConfigService,
    AIGenerationService,
    ConfigService,
  ],
  exports: [
    TestCaseGenerationService,
    TestCaseSuggestionService,
    AssistantManagerService,
    ThreadManagerService,
    OpenAIConfigService,
    AIGenerationService,
  ],
})
export class AIModule {} 