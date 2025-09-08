import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestCase, TestCaseStatus } from '../../test-cases/entities/test-case.entity';

export interface TestCaseExecutionResult {
  scenarioName: string;
  status: 'passed' | 'failed' | 'skipped';
  executionTime: number;
  errorMessage?: string;
}

@Injectable()
export class TestCaseUpdateService {
  private readonly logger = new Logger(TestCaseUpdateService.name);

  constructor(
    @InjectRepository(TestCase)
    private readonly testCaseRepository: Repository<TestCase>,
  ) {}

  /**
   * Updates test cases with aggregated execution results.
   *
   * @param projectId - Project identifier
   * @param entityName - Entity name
   * @param results - Array of scenario execution results
   */
  async updateTestCasesWithExecutionResults(
    projectId: string,
    entityName: string,
    results: TestCaseExecutionResult[],
  ): Promise<void> {
    try {
      this.logger.log(`Updating ${results.length} test cases with execution results`);

      for (const result of results) {
        await this.updateTestCaseWithResult(result);
      }

      this.logger.log(`Test cases updated successfully`);
    } catch (error) {
      this.logger.error(`Error updating test cases: ${error.message}`);
      throw error;
    }
  }

  /**
   * Updates a single test case with the given execution result.
   */
  private async updateTestCaseWithResult(result: TestCaseExecutionResult): Promise<void> {
    try {
      // Look up the test case by scenario name instead of ID
      const testCase = await this.testCaseRepository.findOne({
        where: { name: result.scenarioName },
      });

      if (!testCase) {
        this.logger.warn(`Test case with name "${result.scenarioName}" not found`);
        return;
      }

      // Update last execution fields
      testCase.lastRun = new Date();
      testCase.lastRunStatus = result.status;

      // Update test case status based on result
      if (result.status === 'failed') {
        testCase.status = TestCaseStatus.ACTIVE; // Keep active but mark failure on lastRunStatus
      } else if (result.status === 'passed') {
        testCase.status = TestCaseStatus.ACTIVE;
      }

      await this.testCaseRepository.save(testCase);

      // this.logger.debug(`Test case "${result.scenarioName}" updated with status: ${result.status}`);
    } catch (error) {
      this.logger.error(`Error updating test case "${result.scenarioName}": ${error.message}`);
      // Do not throw to avoid failing the whole batch update
    }
  }

  /**
   * Gets the execution summary for a specific entity.
   */
  async getExecutionSummaryForEntity(
    projectId: string,
    entityName: string,
  ): Promise<{
    totalTestCases: number;
    passedTestCases: number;
    failedTestCases: number;
    skippedTestCases: number;
    successRate: number;
    lastExecution: Date | null;
  }> {
    const testCases = await this.testCaseRepository.find({
      where: { projectId, entityName },
    });

    const totalTestCases = testCases.length;
    const passedTestCases = testCases.filter(tc => tc.lastRunStatus === 'passed').length;
    const failedTestCases = testCases.filter(tc => tc.lastRunStatus === 'failed').length;
    const skippedTestCases = testCases.filter(tc => tc.lastRunStatus === 'skipped').length;

    const successRate = totalTestCases > 0 
      ? (passedTestCases / totalTestCases) * 100 
      : 0;

    const lastExecution = testCases.length > 0 
      ? new Date(Math.max(...testCases.map(tc => tc.lastRun?.getTime() || 0)))
      : null;

    return {
      totalTestCases,
      passedTestCases,
      failedTestCases,
      skippedTestCases,
      successRate,
      lastExecution,
    };
  }

  /**
   * Clears execution results from test cases (useful to reset state).
   */
  async clearExecutionResults(projectId: string, entityName?: string): Promise<void> {
    const whereClause: any = { projectId };
    if (entityName) {
      whereClause.entityName = entityName;
    }

    await this.testCaseRepository.update(whereClause, {
      lastRun: undefined,
      lastRunStatus: undefined,
    });

    this.logger.log(`Execution results cleared for ${entityName || 'all entities'}`);
  }

  /**
   * Returns the count of test cases for a specific entity or the whole project.
   */
  async getTestCasesCount(projectId: string, entityName?: string): Promise<number> {
    const whereClause: any = { projectId };
    if (entityName) {
      whereClause.entityName = entityName;
    }

    return await this.testCaseRepository.count({ where: whereClause });
  }
} 