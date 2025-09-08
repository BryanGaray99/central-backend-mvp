import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { Project } from './project.entity';
import { WorkspaceModule } from '../workspace/workspace.module';
import { GenerationService } from './generation.service';
import { FileSystemService } from './services/file-system.service';
import { TemplateService } from './services/template.service';
import { PlaywrightService } from './services/playwright.service';
import { ValidationService } from './services/validation.service';
import { QueueService } from './services/queue.service';
import { CleanupService } from './services/cleanup.service';

/**
 * Projects module that provides comprehensive project management functionality.
 * 
 * This module handles the creation, management, and lifecycle of testing projects.
 * It includes services for project generation, validation, file system operations,
 * template processing, and cleanup operations.
 * 
 * @module ProjectsModule
 * @since 1.0.0
 */
@Module({
  imports: [TypeOrmModule.forFeature([Project]), WorkspaceModule],
  providers: [
    ProjectsService,
    GenerationService,
    FileSystemService,
    TemplateService,
    PlaywrightService,
    ValidationService,
    QueueService,
    CleanupService,
  ],
  controllers: [ProjectsController],
  exports: [ProjectsService, FileSystemService, TemplateService],
})
export class ProjectsModule {}
