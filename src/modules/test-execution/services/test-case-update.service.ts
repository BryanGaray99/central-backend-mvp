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
   * Actualiza los test cases con los resultados de ejecución
   */
  async updateTestCasesWithExecutionResults(
    projectId: string,
    entityName: string,
    results: TestCaseExecutionResult[],
  ): Promise<void> {
    try {
      this.logger.log(`Actualizando ${results.length} test cases con resultados de ejecución`);

      for (const result of results) {
        await this.updateTestCaseWithResult(result);
      }

      this.logger.log(`Test cases actualizados exitosamente`);
    } catch (error) {
      this.logger.error(`Error actualizando test cases: ${error.message}`);
      throw error;
    }
  }

  /**
   * Actualiza un test case individual con el resultado de ejecución
   */
  private async updateTestCaseWithResult(result: TestCaseExecutionResult): Promise<void> {
    try {
      // Buscar el test case por nombre en lugar de por ID
      const testCase = await this.testCaseRepository.findOne({
        where: { name: result.scenarioName },
      });

      if (!testCase) {
        this.logger.warn(`Test case con nombre "${result.scenarioName}" no encontrado`);
        return;
      }

      // Actualizar campos de última ejecución
      testCase.lastRun = new Date();
      testCase.lastRunStatus = result.status;

      // Actualizar el estado del test case basado en el resultado
      if (result.status === 'failed') {
        testCase.status = TestCaseStatus.ACTIVE; // Mantener activo pero marcar como fallido en lastRunStatus
      } else if (result.status === 'passed') {
        testCase.status = TestCaseStatus.ACTIVE;
      }

      await this.testCaseRepository.save(testCase);

      // this.logger.debug(`Test case "${result.scenarioName}" actualizado con status: ${result.status}`);
    } catch (error) {
      this.logger.error(`Error actualizando test case "${result.scenarioName}": ${error.message}`);
      // No lanzar error para evitar que falle toda la actualización
    }
  }

  /**
   * Obtiene el resumen de ejecución para una entidad específica
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
   * Limpia los resultados de ejecución de test cases (útil para resetear)
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

    this.logger.log(`Resultados de ejecución limpiados para ${entityName || 'todas las entidades'}`);
  }

  /**
   * Obtiene el conteo de test cases para una entidad específica o todo el proyecto
   */
  async getTestCasesCount(projectId: string, entityName?: string): Promise<number> {
    const whereClause: any = { projectId };
    if (entityName) {
      whereClause.entityName = entityName;
    }

    return await this.testCaseRepository.count({ where: whereClause });
  }
} 