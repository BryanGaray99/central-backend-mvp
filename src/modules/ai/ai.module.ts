import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AIAgentService } from './services/ai-agent.service';
import { Project } from '../projects/project.entity';
import { CodeManipulationModule } from '../../common/services/code-manipulation/code-manipulation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project]),
    CodeManipulationModule,
  ],
  providers: [AIAgentService],
  exports: [AIAgentService],
})
export class AIModule {} 