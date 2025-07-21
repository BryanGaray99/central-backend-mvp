import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AIAgentService } from './services/ai-agent.service';
import { Project } from '../projects/project.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Project])],
  providers: [AIAgentService],
  exports: [AIAgentService],
})
export class AIModule {} 