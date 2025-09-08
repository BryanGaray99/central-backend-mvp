import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bug } from './entities/bug.entity';
import { Project } from '../projects/project.entity';
import { TestCase } from '../test-cases/entities/test-case.entity';
import { TestSuite } from '../test-suites/entities/test-suite.entity';
import { Endpoint } from '../endpoints/endpoint.entity';
import { BugsController } from './controllers/bugs.controller';
import { BugsGeneralController } from './controllers/bugs-general.controller';
import { BugsService } from './services/bugs.service';
import { TestExecutionModule } from '../test-execution/test-execution.module';

/**
 * Bugs Module
 * 
 * Manages bug tracking and reporting functionality for test execution failures.
 * Provides comprehensive bug management including creation from failed test executions,
 * bug lifecycle management, statistics, and integration with test execution results.
 * 
 * @module BugsModule
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Bug, Project, TestCase, TestSuite, Endpoint]),
    forwardRef(() => TestExecutionModule),
  ],
  controllers: [BugsController, BugsGeneralController],
  providers: [BugsService],
  exports: [BugsService],
})
export class BugsModule {}
