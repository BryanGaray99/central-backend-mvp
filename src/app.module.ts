/**
 * Main Application Module
 * 
 * Root module of the Central Backend MVP application that orchestrates
 * all feature modules and configures the database connection. This module
 * serves as the central hub for the test generation and orchestration system.
 * 
 * @module AppModule
 * @version 1.0.0
 * @author Central Backend MVP Team
 */

import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Project } from './modules/projects/project.entity';
import { Endpoint } from './modules/endpoints/endpoint.entity';
import { EndpointsModule } from './modules/endpoints/endpoints.module';
import { TestExecution } from './modules/test-execution/entities/test-execution.entity';
import { TestResult } from './modules/test-execution/entities/test-result.entity';
import { TestExecutionModule } from './modules/test-execution/test-execution.module';
import { TestCase } from './modules/test-cases/entities/test-case.entity';
import { TestStep } from './modules/test-cases/entities/test-step.entity';
import { AIGeneration } from './modules/test-cases/entities/ai-generation.entity';
import { TestCasesModule } from './modules/test-cases/test-cases.module';
import { DatabaseModule } from './common/database/database.module';
import { AIAssistant } from './modules/ai/entities/ai-assistant.entity';
import { AIThread } from './modules/ai/entities/ai-thread.entity';
import { AISuggestion } from './modules/ai/entities/ai-suggestion.entity';
import { AIModule } from './modules/ai/ai.module';
import { Bug } from './modules/bugs/entities/bug.entity';
import { TestSuite } from './modules/test-suites/entities/test-suite.entity';
import { BugsModule } from './modules/bugs/bugs.module';
import { TestSuitesModule } from './modules/test-suites/test-suites.module';
import { SyncModule } from './modules/sync/sync.module';

/**
 * Main Application Module
 * 
 * Configures the root module with all feature modules and database connection.
 * Uses SQLite database with TypeORM for data persistence and includes all
 * business modules for the test generation system.
 * 
 * @class AppModule
 */
@Module({
  imports: [
    // Serve frontend static assets in local production (monolithic build)
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, 'public'),
      serveRoot: '/',
      exclude: ['/v1/api*', '/docs*'],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule, DatabaseModule],
      useFactory: async (configService: ConfigService) => {
        // Use the new database path
        const workspacesPath = configService.get('PLAYWRIGHT_WORKSPACES_PATH') || '../playwright-workspaces';
        const dbPath = require('path').resolve(workspacesPath, 'central-backend.sqlite');
        
        return {
          type: 'sqlite',
          database: dbPath,
          entities: [
            Project,
            Endpoint,
            TestExecution,
            TestResult,
            TestCase,
            TestStep,
            AIGeneration,
            AIAssistant,
            AIThread,
            AISuggestion,
            Bug,
            TestSuite,
          ],
          synchronize: false, // Disable synchronize since we use migrations
        };
      },
      inject: [ConfigService],
    }),
    DatabaseModule,
    WorkspaceModule,
    ProjectsModule,
    EndpointsModule,
    TestExecutionModule,
    TestCasesModule,
    AIModule,
    BugsModule,
    TestSuitesModule,
    SyncModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
