import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestExecutionController } from './controllers/test-execution.controller';
import { GlobalTestExecutionController } from './controllers/global-test-execution.controller';
import { TestExecutionService } from './services/test-execution.service';
import { TestRunnerService } from './services/test-runner.service';
import { TestResultsListenerService } from './services/test-results-listener.service';
import { ExecutionLoggerService } from './services/execution-logger.service';
import { TestCaseUpdateService } from './services/test-case-update.service';
import { ExecutionEventsService } from './services/execution-events.service';
import { TestExecution } from './entities/test-execution.entity';
import { TestResult } from './entities/test-result.entity';
import { Project } from '../projects/project.entity';
import { TestCase } from '../test-cases/entities/test-case.entity';
import { TestSuitesModule } from '../test-suites/test-suites.module';
import { BugsModule } from '../bugs/bugs.module';

/**
 * Module: TestExecutionModule
 *
 * Provides all components required for executing tests, collecting results,
 * logging, streaming events (SSE), and integrating with test suites and bugs.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([TestExecution, TestResult, Project, TestCase]),
    forwardRef(() => TestSuitesModule),
    forwardRef(() => BugsModule),
  ],
  controllers: [TestExecutionController, GlobalTestExecutionController],
  providers: [
    TestExecutionService,
    TestRunnerService,
    TestResultsListenerService,
    ExecutionLoggerService,
    TestCaseUpdateService,
    ExecutionEventsService,
  ],
  exports: [
    TestExecutionService,
    TestRunnerService,
    TestResultsListenerService,
    ExecutionLoggerService,
    TestCaseUpdateService,
    ExecutionEventsService,
  ],
})
export class TestExecutionModule {} 