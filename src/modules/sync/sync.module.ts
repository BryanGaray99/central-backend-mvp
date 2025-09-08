import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncController } from './controllers/sync.controller';
import { SyncService } from './services/sync.service';
import { Project } from '../projects/project.entity';
import { Endpoint } from '../endpoints/endpoint.entity';
import { TestCase } from '../test-cases/entities/test-case.entity';
import { TestStep } from '../test-cases/entities/test-step.entity';
import { ProjectsModule } from '../projects/projects.module';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { TestCasesModule } from '../test-cases/test-cases.module';

/**
 * Sync Module
 * 
 * Manages project synchronization functionality between file system artifacts
 * and database entities. Provides comprehensive synchronization of endpoints,
 * test cases, and test steps to ensure consistency between generated files
 * and database records.
 * 
 * @module SyncModule
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Endpoint, TestCase, TestStep]),
    ProjectsModule,
    EndpointsModule,
    TestCasesModule,
  ],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
