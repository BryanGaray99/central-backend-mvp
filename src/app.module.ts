import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { ProjectsModule } from './modules/projects/projects.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DB_PATH || 'central-backend.sqlite',
      autoLoadEntities: true,
      synchronize: true, // Solo para desarrollo
      logging: true,
    }),
    WorkspaceModule,
    ProjectsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
