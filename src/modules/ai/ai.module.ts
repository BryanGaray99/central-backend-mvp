import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestCaseGenerationService } from './services/test-case-generation.service';
import { TestCaseSuggestionService } from './services/test-case-suggestion.service';
import { AssistantManagerService } from './services/assistant-manager.service';
import { ThreadManagerService } from './services/thread-manager.service';
import { AIController } from './controllers/ai.controller';
import { Project } from '../projects/project.entity';
import { CodeManipulationModule } from '../../common/services/code-manipulation/code-manipulation.module';
import { AIAssistant, AIThread, AISuggestion } from './entities';
import { Endpoint } from '../endpoints/endpoint.entity';
import { ConfigService } from '@nestjs/config';
import { TestCasesModule } from '../test-cases/test-cases.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, AIAssistant, AIThread, AISuggestion, Endpoint]),
    CodeManipulationModule,
    forwardRef(() => TestCasesModule),
  ],
  controllers: [AIController],
  providers: [
    TestCaseGenerationService,
    TestCaseSuggestionService,
    AssistantManagerService,
    ThreadManagerService,
    ConfigService,
  ],
  exports: [
    TestCaseGenerationService,
    TestCaseSuggestionService,
    AssistantManagerService,
    ThreadManagerService,
  ],
})
export class AIModule {} 