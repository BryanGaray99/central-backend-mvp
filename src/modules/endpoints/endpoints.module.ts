import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../projects/project.entity';
import { EndpointsController } from './endpoints.controller';
import { EndpointsService } from './endpoints.service';
import { AnalysisService } from './services/analysis.service';
import { ArtifactsGenerationService } from './services/artifacts-generation.service';
import { HttpModule } from '@nestjs/axios';
import { FileSystemService } from '../projects/services/file-system.service';
import { TemplateService } from '../projects/services/template.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project]), 
    HttpModule
  ],
  controllers: [EndpointsController],
  providers: [
    EndpointsService, 
    AnalysisService, 
    ArtifactsGenerationService,
    FileSystemService,
    TemplateService
  ],
})
export class EndpointsModule {} 