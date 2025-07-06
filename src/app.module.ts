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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const dbPath = configService.get('DATABASE_PATH');
        if (!dbPath) {
          throw new Error(
            'DATABASE_PATH must be defined as an absolute or relative path.',
          );
        }
        return {
          type: 'sqlite',
          database: dbPath,
          entities: [Project, Endpoint, TestExecution, TestResult],
          synchronize: true,
        };
      },
      inject: [ConfigService],
    }),
    WorkspaceModule,
    ProjectsModule,
    EndpointsModule,
    TestExecutionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
