import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestCaseGenerationService } from './services/test-case-generation.service';
import { AssistantManagerService } from './services/assistant-manager.service';
import { ThreadManagerService } from './services/thread-manager.service';
import { AIController } from './controllers/ai.controller';
import { Project } from '../projects/project.entity';
import { CodeManipulationModule } from '../../common/services/code-manipulation/code-manipulation.module';
import { AIAssistant, AIThread } from './entities';
import { Endpoint } from '../endpoints/endpoint.entity';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, AIAssistant, AIThread, Endpoint]),
    CodeManipulationModule,
  ],
  controllers: [AIController],
  providers: [
    TestCaseGenerationService,
    AssistantManagerService,
    ThreadManagerService,
    ConfigService,
  ],
  exports: [
    TestCaseGenerationService,
    AssistantManagerService,
    ThreadManagerService,
  ],
})
export class AIModule {} 