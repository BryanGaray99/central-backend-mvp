import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { EndpointsController } from './controllers/endpoints.controller';
import { EndpointsService } from './endpoints.service';
import { Endpoint } from './endpoint.entity';
import { Project } from '../projects/project.entity';
import { AnalysisService } from './services/analysis.service';
import { ArtifactsGenerationService } from './services/artifacts-generation.service';
import { TemplateVariablesService } from './services/template-variables.service';
import { ArtifactsFileGeneratorService } from './services/artifacts-file-generator.service';
import { HooksUpdaterService } from './services/hooks-updater.service';
import { ApiConfigUpdaterService } from './services/api-config-updater.service';
import { CleanupService } from './services/cleanup.service';
import { FileSystemService } from '../projects/services/file-system.service';
import { TemplateService } from '../projects/services/template.service';
import { TestCasesModule } from '../test-cases/test-cases.module';
import { ProjectEndpointsController } from './controllers/project-endpoints.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Endpoint]),
    forwardRef(() => TestCasesModule),
    HttpModule,
  ],
  controllers: [EndpointsController, ProjectEndpointsController],
  providers: [
    EndpointsService,
    AnalysisService,
    ArtifactsGenerationService,
    TemplateVariablesService,
    ArtifactsFileGeneratorService,
    HooksUpdaterService,
    ApiConfigUpdaterService,
    CleanupService,
    FileSystemService,
    TemplateService,
  ],
  exports: [EndpointsService, ApiConfigUpdaterService],
})
export class EndpointsModule {} 
