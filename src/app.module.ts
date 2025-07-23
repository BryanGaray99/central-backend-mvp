import { Module } from '@nestjs/common';
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
import { DatabaseMigrationModule } from './common/database-migration.module';
import { AIAssistant } from './modules/ai/entities/ai-assistant.entity';
import { AIThread } from './modules/ai/entities/ai-thread.entity';
import { AIModule } from './modules/ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule, DatabaseMigrationModule],
      useFactory: async (configService: ConfigService) => {
        // Usar la nueva ruta de la base de datos
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
          ],
          synchronize: false, // Desactivar synchronize ya que usamos migraciones
        };
      },
      inject: [ConfigService],
    }),
    DatabaseMigrationModule,
    WorkspaceModule,
    ProjectsModule,
    EndpointsModule,
    TestExecutionModule,
    TestCasesModule,
    AIModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
