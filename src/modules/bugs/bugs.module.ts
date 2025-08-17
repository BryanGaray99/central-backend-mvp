import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bug } from './entities/bug.entity';
import { Project } from '../projects/project.entity';
import { TestCase } from '../test-cases/entities/test-case.entity';
import { TestSuite } from '../test-suites/entities/test-suite.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bug, Project, TestCase, TestSuite]),
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class BugsModule {}
