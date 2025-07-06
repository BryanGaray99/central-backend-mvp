import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestExecutionController } from './controllers/test-execution.controller';
import { TestExecutionService } from './services/test-execution.service';
import { TestRunnerService } from './services/test-runner.service';
import { TestResultsListenerService } from './services/test-results-listener.service';
import { MetadataUpdaterService } from './services/metadata-updater.service';
import { TestExecution } from './entities/test-execution.entity';
import { TestResult } from './entities/test-result.entity';
import { Project } from '../projects/project.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TestExecution, TestResult, Project]),
  ],
  controllers: [TestExecutionController],
  providers: [
    TestExecutionService,
    TestRunnerService,
    TestResultsListenerService,
    MetadataUpdaterService,
  ],
  exports: [
    TestExecutionService,
    TestRunnerService,
    TestResultsListenerService,
    MetadataUpdaterService,
  ],
})
export class TestExecutionModule {} 