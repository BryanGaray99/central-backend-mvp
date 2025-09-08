import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestSuite } from './entities/test-suite.entity';
import { Project } from '../projects/project.entity';
import { Bug } from '../bugs/entities/bug.entity';
import { TestCase } from '../test-cases/entities/test-case.entity';
import { TestSuitesController } from './controllers/test-suites.controller';
import { TestSuitesService } from './services/test-suites.service';
import { TestExecutionModule } from '../test-execution/test-execution.module';

/**
 * Module: TestSuitesModule
 *
 * Exposes endpoints and services to manage test suites (test sets and plans),
 * and integrates with the test-execution module.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([TestSuite, Project, Bug, TestCase]),
    forwardRef(() => TestExecutionModule),
  ],
  controllers: [TestSuitesController],
  providers: [TestSuitesService],
  exports: [TestSuitesService],
})
export class TestSuitesModule {}
