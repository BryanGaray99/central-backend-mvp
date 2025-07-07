import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { EndpointsController } from './endpoints.controller';
import { EndpointsService } from './endpoints.service';
import { Endpoint } from './endpoint.entity';
import { Project } from '../projects/project.entity';
import { AnalysisService } from './services/analysis.service';
import { ArtifactsGenerationService } from './services/artifacts-generation.service';
import { TemplateVariablesService } from './services/template-variables.service';
import { ArtifactsFileGeneratorService } from './services/artifacts-file-generator.service';
import { ProjectMetaService } from './services/project-meta.service';
import { HooksUpdaterService } from './services/hooks-updater.service';
import { ApiConfigUpdaterService } from './services/api-config-updater.service';
import { CleanupService } from './services/cleanup.service';
import { FileSystemService } from '../projects/services/file-system.service';
import { TemplateService } from '../projects/services/template.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Endpoint, Project]),
    HttpModule,
  ],
  controllers: [EndpointsController],
  providers: [
    EndpointsService,
    AnalysisService,
    ArtifactsGenerationService,
    TemplateVariablesService,
    ArtifactsFileGeneratorService,
    ProjectMetaService,
    HooksUpdaterService,
    ApiConfigUpdaterService,
    CleanupService,
    FileSystemService,
    TemplateService,
  ],
  exports: [EndpointsService, ApiConfigUpdaterService, ProjectMetaService],
})
export class EndpointsModule {} 
