import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Project } from './modules/projects/project.entity';
import { EndpointsModule } from './modules/endpoints/endpoints.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'sqlite',
        database: configService.get<string>('DATABASE_PATH', 'central-backend.sqlite'),
        entities: [Project],
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    WorkspaceModule,
    ProjectsModule,
    EndpointsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
