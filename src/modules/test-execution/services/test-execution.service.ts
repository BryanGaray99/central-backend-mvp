import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestExecution, ExecutionStatus } from '../entities/test-execution.entity';
import { TestResult } from '../entities/test-result.entity';
import { Project } from '../../projects/project.entity';
import { ExecuteTestsDto } from '../dto/execute-tests.dto';
import { ExecutionFiltersDto } from '../dto/execution-filters.dto';
import { TestRunnerService } from './test-runner.service';
import { TestResultsListenerService } from './test-results-listener.service';
import { ExecutionLoggerService } from './execution-logger.service';
import { TestCaseUpdateService } from './test-case-update.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TestExecutionService {
  private readonly logger = new Logger(TestExecutionService.name);

  constructor(
    @InjectRepository(TestExecution)
    private readonly testExecutionRepository: Repository<TestExecution>,
    @InjectRepository(TestResult)
    private readonly testResultRepository: Repository<TestResult>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly testRunnerService: TestRunnerService,
    private readonly testResultsListenerService: TestResultsListenerService,
    private readonly executionLoggerService: ExecutionLoggerService,
    private readonly testCaseUpdateService: TestCaseUpdateService,
  ) {}

  async executeTests(projectId: string, dto: ExecuteTestsDto) {
    const entityName = dto.entityName || 'all';
    this.logger.log(`Iniciando ejecución de pruebas para entidad: ${entityName}`);

    // Validar que el proyecto existe
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException(`Proyecto con ID ${projectId} no encontrado`);
    }

    // Si se especifica una entidad, validar que tiene casos de prueba
    if (dto.entityName) {
      const hasTestCases = await this.validateEntityHasTestCases(project.path, dto.entityName);
      if (!hasTestCases) {
        throw new BadRequestException(
          `No se encontraron casos de prueba para la entidad '${dto.entityName}'. Verifique que la entidad esté registrada y tenga casos de prueba generados.`
        );
      }
    }

    // Crear registro de ejecución
    const execution = this.testExecutionRepository.create({
      projectId,
      executionId: uuidv4(),
      entityName: entityName, // Usar el valor calculado en lugar de dto.entityName
      method: dto.method,
      testType: dto.testType,
      tags: dto.tags,
      specificScenario: dto.specificScenario,
      status: ExecutionStatus.PENDING,
      metadata: {
        environment: dto.environment,
        verbose: dto.verbose,
        saveLogs: dto.saveLogs,
        savePayloads: dto.savePayloads,
        parallel: dto.parallel,
        timeout: dto.timeout,
        retries: dto.retries,
        workers: dto.workers,
      },
    });

    const savedExecution = await this.testExecutionRepository.save(execution);

    // Ejecutar pruebas en background
    this.runTestsInBackground(savedExecution, project, dto);

    // Contar test cases que se van a actualizar
    const testCasesToUpdate = dto.entityName 
      ? await this.countTestCasesForEntity(projectId, dto.entityName)
      : await this.countAllTestCasesForProject(projectId);

    return {
      executionId: savedExecution.executionId,
      status: savedExecution.status,
      message: entityName === 'all'
        ? `Ejecución de pruebas iniciada para todos los test cases del proyecto`
        : `Ejecución de pruebas iniciada para entidad '${entityName}'`,
      startedAt: savedExecution.startedAt,
      testCasesToUpdate,
      entityName: savedExecution.entityName,
    };
  }

  async getResults(executionId: string) {
    const execution = await this.testExecutionRepository.findOne({
      where: { executionId },
      relations: ['results'],
    });

    if (!execution) {
      throw new NotFoundException(`Ejecución con ID ${executionId} no encontrada`);
    }

    const summary = this.calculateSummary(execution);

    // Enriquecer los resultados con información adicional
    const enrichedResults = execution.results.map(result => ({
      id: result.id,
      scenarioName: result.scenarioName,
      scenarioTags: result.scenarioTags,
      status: result.status,
      duration: result.duration,
      steps: result.steps || [],
      errorMessage: result.errorMessage,
      metadata: result.metadata || {},
      createdAt: result.createdAt,
      // Información adicional calculada
      stepCount: result.steps?.length || 0,
      passedSteps: result.steps?.filter(step => step.status === 'passed').length || 0,
      failedSteps: result.steps?.filter(step => step.status === 'failed').length || 0,
      skippedSteps: result.steps?.filter(step => step.status === 'skipped').length || 0,
      // Estadísticas excluyendo hooks
      actualStepCount: result.steps?.filter(step => !step.isHook).length || 0,
      passedActualSteps: result.steps?.filter(step => !step.isHook && step.status === 'passed').length || 0,
      failedActualSteps: result.steps?.filter(step => !step.isHook && step.status === 'failed').length || 0,
      successRate: result.steps?.length > 0 
        ? (result.steps.filter(step => step.status === 'passed').length / result.steps.length) * 100 
        : 0,
      actualSuccessRate: result.steps?.filter(step => !step.isHook).length > 0 
        ? (result.steps.filter(step => !step.isHook && step.status === 'passed').length / result.steps.filter(step => !step.isHook).length) * 100 
        : 0,
    }));

    return {
      executionId: execution.executionId,
      status: execution.status,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      executionTime: execution.executionTime,
      summary,
      results: enrichedResults,
      metadata: execution.metadata,
      errorMessage: execution.errorMessage,
      // Información adicional de la ejecución
      entityName: execution.entityName,
      method: execution.method,
      testType: execution.testType,
      tags: execution.tags,
      specificScenario: execution.specificScenario,
      totalScenarios: execution.totalScenarios,
      passedScenarios: execution.passedScenarios,
      failedScenarios: execution.failedScenarios,
      createdAt: execution.createdAt,
      updatedAt: execution.updatedAt,
    };
  }

  async listResults(projectId: string, filters: ExecutionFiltersDto) {
    const query = this.testExecutionRepository.createQueryBuilder('execution')
      .where('execution.projectId = :projectId', { projectId })
      .orderBy('execution.startedAt', 'DESC');

    // Aplicar filtros
    if (filters.entityName) {
      query.andWhere('execution.entityName = :entityName', { entityName: filters.entityName });
    }

    if (filters.method) {
      query.andWhere('execution.method = :method', { method: filters.method });
    }

    if (filters.testType) {
      query.andWhere('execution.testType = :testType', { testType: filters.testType });
    }

    if (filters.status) {
      query.andWhere('execution.status = :status', { status: filters.status });
    }

    if (filters.dateFrom) {
      query.andWhere('execution.startedAt >= :dateFrom', { dateFrom: filters.dateFrom });
    }

    if (filters.dateTo) {
      query.andWhere('execution.startedAt <= :dateTo', { dateTo: filters.dateTo });
    }

    // Paginación
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    query.skip(offset).take(limit);

    const [executions, total] = await query.getManyAndCount();

    return {
      executions: executions.map(execution => ({
        executionId: execution.executionId,
        entityName: execution.entityName,
        method: execution.method,
        testType: execution.testType,
        status: execution.status,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        executionTime: execution.executionTime,
        totalScenarios: execution.totalScenarios,
        passedScenarios: execution.passedScenarios,
        failedScenarios: execution.failedScenarios,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async deleteResults(executionId: string) {
    const execution = await this.testExecutionRepository.findOne({
      where: { executionId },
    });

    if (!execution) {
      throw new NotFoundException(`Ejecución con ID ${executionId} no encontrada`);
    }

    // Eliminar resultados asociados
    await this.testResultRepository.delete({ executionId: execution.executionId });

    // Eliminar ejecución
    await this.testExecutionRepository.remove(execution);

    this.logger.log(`Ejecución ${executionId} eliminada exitosamente`);
  }

  async getExecutionHistory(projectId: string, entityName: string) {
    const executions = await this.testExecutionRepository.find({
      where: { projectId, entityName },
      order: { startedAt: 'DESC' },
      take: 10,
    });

    return executions.map(execution => ({
      executionId: execution.executionId,
      status: execution.status,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      executionTime: execution.executionTime,
      totalScenarios: execution.totalScenarios,
      passedScenarios: execution.passedScenarios,
      failedScenarios: execution.failedScenarios,
      successRate: execution.totalScenarios > 0 
        ? (execution.passedScenarios / execution.totalScenarios) * 100 
        : 0,
    }));
  }

  async getExecutionSummary(projectId: string) {
    const [executions, totalExecutions] = await this.testExecutionRepository.findAndCount({
      where: { projectId },
    });

    const totalScenarios = executions.reduce((sum, exec) => sum + exec.totalScenarios, 0);
    const totalPassed = executions.reduce((sum, exec) => sum + exec.passedScenarios, 0);
    const totalFailed = executions.reduce((sum, exec) => sum + exec.failedScenarios, 0);
    const totalTime = executions.reduce((sum, exec) => sum + exec.executionTime, 0);

    const statusCounts = executions.reduce((acc, exec) => {
      acc[exec.status] = (acc[exec.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalExecutions,
      totalScenarios,
      totalPassed,
      totalFailed,
      successRate: totalScenarios > 0 ? (totalPassed / totalScenarios) * 100 : 0,
      averageExecutionTime: totalExecutions > 0 ? totalTime / totalExecutions : 0,
      statusDistribution: statusCounts,
      lastExecution: executions.length > 0 ? executions[0].startedAt : null,
    };
  }

  async getGlobalExecutionSummary() {
    const [executions, totalExecutions] = await this.testExecutionRepository.findAndCount({
      order: { startedAt: 'DESC' },
    });

    const totalScenarios = executions.reduce((sum, exec) => sum + exec.totalScenarios, 0);
    const totalPassed = executions.reduce((sum, exec) => sum + exec.passedScenarios, 0);
    const totalFailed = executions.reduce((sum, exec) => sum + exec.failedScenarios, 0);
    const totalTime = executions.reduce((sum, exec) => sum + exec.executionTime, 0);

    const statusCounts = executions.reduce((acc, exec) => {
      acc[exec.status] = (acc[exec.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalExecutions,
      totalScenarios,
      totalPassed,
      totalFailed,
      successRate: totalScenarios > 0 ? (totalPassed / totalScenarios) * 100 : 0,
      averageExecutionTime: totalExecutions > 0 ? totalTime / totalExecutions : 0,
      statusDistribution: statusCounts,
      lastExecution: executions.length > 0 ? executions[0].startedAt : null,
    };
  }

  private async validateEntityHasTestCases(projectPath: string, entityName: string): Promise<boolean> {
    // Verificar que existe el archivo de feature para la entidad
    const featurePath = `${projectPath}/src/features/ecommerce/${entityName.toLowerCase()}.feature`;
    
    try {
      const fs = require('fs');
      return fs.existsSync(featurePath);
    } catch (error) {
      return false;
    }
  }

  private async runTestsInBackground(execution: TestExecution, project: Project, dto: ExecuteTestsDto) {
    try {
      // Actualizar estado a running
      execution.status = ExecutionStatus.RUNNING;
      await this.testExecutionRepository.save(execution);

      // Crear un DTO modificado con el entityName correcto
      const modifiedDto = {
        ...dto,
        entityName: execution.entityName, // Usar el valor guardado en la ejecución
      };

      // Ejecutar pruebas usando el servicio de runner
      const results = await this.testRunnerService.runPlaywrightTests(project.path, modifiedDto);

      // Actualizar ejecución con resultados
      execution.status = ExecutionStatus.COMPLETED;
      execution.completedAt = new Date();
      execution.executionTime = results.executionTime;
      execution.totalScenarios = results.totalScenarios;
      execution.passedScenarios = results.passedScenarios;
      execution.failedScenarios = results.failedScenarios;

      await this.testExecutionRepository.save(execution);

      // Guardar resultados individuales
      for (const result of results.results) {
        const testResult = this.testResultRepository.create({
          executionId: execution.executionId,
          scenarioName: result.scenarioName,
          scenarioTags: result.scenarioTags,
          status: result.status,
          duration: result.duration,
          steps: result.steps,
          errorMessage: result.errorMessage,
          metadata: result.metadata,
        });
        await this.testResultRepository.save(testResult);
      }

      // ✅ NUEVO: Actualizar test cases con resultados de ejecución
      const testCaseResults = results.results.map(result => ({
        scenarioName: result.scenarioName,
        status: result.status,
        executionTime: result.duration,
        errorMessage: result.errorMessage,
      }));

      await this.testCaseUpdateService.updateTestCasesWithExecutionResults(
        project.id,
        execution.entityName,
        testCaseResults,
      );

      // Registrar información de la ejecución completada
      await this.executionLoggerService.logExecutionCompleted(
        project.id,
        execution.entityName,
        {
          executionId: execution.executionId,
          status: execution.status,
          summary: this.calculateSummary(execution),
          results: results.results,
        }
      );

      this.logger.log(`Ejecución ${execution.executionId} completada exitosamente`);
    } catch (error) {
      this.logger.error(`Error en ejecución ${execution.executionId}:`, error);

      execution.status = ExecutionStatus.FAILED;
      execution.errorMessage = error.message;
      execution.completedAt = new Date();
      execution.executionTime = Date.now() - execution.startedAt.getTime();

      await this.testExecutionRepository.save(execution);
    }
  }

  private calculateSummary(execution: TestExecution) {
    const successRate = execution.totalScenarios > 0 
      ? (execution.passedScenarios / execution.totalScenarios) * 100 
      : 0;

    return {
      totalScenarios: execution.totalScenarios,
      passedScenarios: execution.passedScenarios,
      failedScenarios: execution.failedScenarios,
      skippedScenarios: execution.totalScenarios - execution.passedScenarios - execution.failedScenarios,
      successRate,
      averageDuration: execution.totalScenarios > 0 ? execution.executionTime / execution.totalScenarios : 0,
      totalDuration: execution.executionTime,
      startTime: execution.startedAt,
      endTime: execution.completedAt,
    };
  }



  /**
   * Cuenta test cases para una entidad específica
   */
  private async countTestCasesForEntity(projectId: string, entityName: string): Promise<number> {
    return await this.testCaseUpdateService.getTestCasesCount(projectId, entityName);
  }

  /**
   * Cuenta todos los test cases de un proyecto
   */
  private async countAllTestCasesForProject(projectId: string): Promise<number> {
    return await this.testCaseUpdateService.getTestCasesCount(projectId);
  }
} 