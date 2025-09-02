import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Observable, interval } from 'rxjs';
import { map } from 'rxjs/operators';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestExecution, ExecutionStatus } from '../entities/test-execution.entity';
import { TestResult } from '../entities/test-result.entity';
import { Project } from '../../projects/project.entity';
import { TestCase } from '../../test-cases/entities/test-case.entity';
import { ExecuteTestsDto } from '../dto/execute-tests.dto';
import { ExecutionFiltersDto } from '../dto/execution-filters.dto';
import { TestRunnerService } from './test-runner.service';
import { TestResultsListenerService } from './test-results-listener.service';
import { ExecutionLoggerService } from './execution-logger.service';
import { TestCaseUpdateService } from './test-case-update.service';
import { TestSuitesService } from '../../test-suites/services/test-suites.service';
import { ExecutionEventsService } from './execution-events.service';
import { BugsService } from '../../bugs/services/bugs.service';
import { BugType, BugSeverity, BugPriority } from '../../bugs/entities/bug.entity';
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
    @InjectRepository(TestCase)
    private readonly testCaseRepository: Repository<TestCase>,
    private readonly testRunnerService: TestRunnerService,
    private readonly testResultsListenerService: TestResultsListenerService,
    private readonly executionLoggerService: ExecutionLoggerService,
    private readonly testCaseUpdateService: TestCaseUpdateService,
    @Inject(forwardRef(() => TestSuitesService))
    private readonly testSuitesService: TestSuitesService,
    private readonly executionEventsService: ExecutionEventsService,
    @Inject(forwardRef(() => BugsService))
    private readonly bugsService: BugsService,
  ) {}

    async executeTests(projectId: string, dto: ExecuteTestsDto) {
    let entityName = dto.entityName || 'all';
    this.logger.log(`Iniciando ejecución de pruebas para entidad: ${entityName}`);

    // Validar que el proyecto existe
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException(`Proyecto con ID ${projectId} no encontrado`);
    }

    // Si es un test plan, extraer todos los test cases de todos los test sets
    let specificScenarios = dto.specificScenario;
    
          if (dto.testSuiteId && dto.testSuiteId.startsWith('PLAN-')) {
        this.logger.log(`Detectado test plan: ${dto.testSuiteId}`);
        
        // Buscar el test plan para obtener los test sets y test cases
        const testPlan = await this.testSuitesService.getTestSuite(projectId, dto.testSuiteId);
        
        if (testPlan && testPlan.testSets) {
          const allTestCases: string[] = [];
          let testPlanEntity = '';
          
          this.logger.log(`🔍 DEBUG Test Plan Structure:`);
          this.logger.log(`  - Test Sets count: ${testPlan.testSets.length}`);
          this.logger.log(`  - First test set: ${JSON.stringify(testPlan.testSets[0])}`);
          
          // Para test plans, necesitamos obtener los NOMBRES descriptivos de los test cases
          // Los IDs están en testSets.testCases, pero necesitamos buscar los nombres en la base de datos
          for (const testSet of testPlan.testSets) {
            if (testSet.testCases && Array.isArray(testSet.testCases)) {
              // Buscar cada test case en la base de datos para obtener su nombre descriptivo
              for (const testCaseId of testSet.testCases) {
                try {
                  // Buscar el test case por ID para obtener su nombre descriptivo
                  const testCase = await this.testCaseRepository.findOne({
                    where: { testCaseId, projectId }
                  });
                  
                  if (testCase && testCase.name) {
                    allTestCases.push(testCase.name);
                    this.logger.log(`🔍 DEBUG Test Case ${testCaseId} -> Name: ${testCase.name}`);
                  } else {
                    this.logger.warn(`⚠️ Test case ${testCaseId} no encontrado o sin nombre`);
                    // Fallback: usar el ID si no se encuentra el nombre
                    allTestCases.push(testCaseId);
                  }
                  
                  // Determinar la entidad del test plan basada en el primer test case
                  if (!testPlanEntity && testCase) {
                    testPlanEntity = testCase.entityName;
                  }
                } catch (error) {
                  this.logger.error(`Error buscando test case ${testCaseId}: ${error.message}`);
                  // Fallback: usar el ID si hay error
                  allTestCases.push(testCaseId);
                }
              }
            }
          }
          
          // Eliminar duplicados y contar solo test cases únicos
          const uniqueTestCases = [...new Set(allTestCases)];
          
          if (uniqueTestCases.length > 0) {
            specificScenarios = uniqueTestCases.join(',');
            // Usar la entidad determinada del test plan en lugar de 'all'
            if (testPlanEntity) {
              entityName = testPlanEntity;
              this.logger.log(`Test plan ${dto.testSuiteId} usa entidad: ${entityName}`);
            }
            this.logger.log(`Test plan ${dto.testSuiteId} contiene ${uniqueTestCases.length} test cases únicos: ${uniqueTestCases.join(', ')}`);
            this.logger.log(`🔍 DEBUG Specific Scenarios para ejecución: ${specificScenarios}`);
          }
        }
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
      entityName: entityName, // Usar la entidad calculada (puede ser 'Product' en lugar de 'all' para test plans)
      method: dto.method,
      testType: dto.testType,
      tags: dto.tags,
      specificScenario: specificScenarios, // Usar los test cases extraídos del test plan
      status: ExecutionStatus.PENDING,
      testCaseId: dto.testCaseId,
      testSuiteId: dto.testSuiteId,
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

    // Emitir evento de inicio de ejecución
    this.executionEventsService.emitExecutionStarted(
      savedExecution.executionId,
      projectId,
      savedExecution.entityName,
      dto.testSuiteId,
      dto.testCaseId
    );

    // Log de debug para test plans
    if (dto.testSuiteId && dto.testSuiteId.startsWith('PLAN-')) {
      this.logger.log(`🔍 DEBUG Test Plan Execution:`);
      this.logger.log(`  - Entity Name: ${savedExecution.entityName}`);
      this.logger.log(`  - Specific Scenarios: ${savedExecution.specificScenario}`);
      this.logger.log(`  - Test Suite ID: ${savedExecution.testSuiteId}`);
    }

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

    // Enriquecer cada ejecución con información adicional de los resultados y test cases
    const enrichedExecutions = await Promise.all(
      executions.map(async (execution) => {
        // Obtener todos los resultados para extraer información adicional
        const allResults = await this.testResultRepository.find({
          where: { executionId: execution.executionId },
          order: { createdAt: 'ASC' }
        });

        // Obtener el primer resultado para información básica
        const firstResult = allResults.length > 0 ? allResults[0] : null;

        // Buscar el test case correspondiente usando el scenarioName base (sin Example)
        let testCase: any = null;
        if (firstResult) {
          // Obtener el nombre base del scenario (sin sufijo de Example)
          let baseScenarioName = firstResult.scenarioName || '';
          if (baseScenarioName.includes('(Example')) {
            baseScenarioName = baseScenarioName.split('(Example')[0].trim();
          }
          
          testCase = await this.testExecutionRepository.manager
            .createQueryBuilder()
            .select('tc.*')
            .from('test_cases', 'tc')
            .where('tc.projectId = :projectId', { projectId })
            .andWhere('tc.name = :scenarioName', { scenarioName: baseScenarioName })
            .getRawOne();
        }

        // Extraer información de la metadata del resultado
        let section = 'N/A';
        let feature = 'N/A';
        let tags: string[] = [];
        let scenarioName = execution.specificScenario || 'N/A';
        let testCaseId = execution.testCaseId || 'N/A';
        let testCaseDescription = 'N/A';
        let testCaseMethod = 'N/A';
        let testCaseTestType = 'N/A';
        let testSuiteId = execution.testSuiteId || 'N/A';
        let testSuiteName = 'N/A';

        // Obtener el nombre de la test suite si existe
        if (testSuiteId && testSuiteId !== 'N/A') {
          try {
            // Usar el servicio de test suites para obtener el nombre
            const testSuite = await this.testSuitesService.getTestSuite(projectId, testSuiteId);
            if (testSuite && testSuite.name) {
              testSuiteName = testSuite.name;
              this.logger.log(`✅ Test suite name obtained: ${testSuiteName} for ${testSuiteId}`);
            } else {
              this.logger.warn(`⚠️ Test suite ${testSuiteId} found but no name available`);
            }
          } catch (error) {
            this.logger.warn(`Error getting test suite name for ${testSuiteId}: ${error.message}`);
            // Fallback: intentar obtener solo el nombre con una consulta directa
            try {
              const testSuite = await this.testExecutionRepository.manager
                .createQueryBuilder()
                .select('ts.name')
                .from('test_suites', 'ts')
                .where('ts.projectId = :projectId', { projectId })
                .andWhere('ts.suiteId = :suiteId', { suiteId: testSuiteId })
                .getRawOne();
              
              if (testSuite) {
                testSuiteName = testSuite.name || 'N/A';
                this.logger.log(`✅ Test suite name obtained via fallback: ${testSuiteName}`);
              }
            } catch (fallbackError) {
              this.logger.error(`Fallback query also failed for ${testSuiteId}: ${fallbackError.message}`);
            }
          }
        }

        this.logger.log(`Using testCaseId from DB: ${testCaseId} for execution ${execution.executionId}`);
        this.logger.log(`Using testSuiteId from DB: ${testSuiteId} for execution ${execution.executionId}`);
        this.logger.log(`Using testSuiteName from DB: ${testSuiteName} for execution ${execution.executionId}`);

        // Estadísticas de steps de todos los resultados
        let totalSteps = 0;
        let passedSteps = 0;
        let failedSteps = 0;
        let skippedSteps = 0;
        let totalStepDuration = 0;
        let allSteps: any[] = [];
        let allScenarioTags: string[] = [];
        let allErrorMessages: string[] = [];

        if (firstResult) {
          scenarioName = firstResult.scenarioName;
          
          // Parsear metadata si existe
          if (firstResult.metadata) {
            try {
              const metadata = typeof firstResult.metadata === 'string' 
                ? JSON.parse(firstResult.metadata) 
                : firstResult.metadata;
              
              feature = metadata.feature || 'N/A';
              tags = metadata.tags || [];
            } catch (error) {
              this.logger.warn(`Error parsing metadata for execution ${execution.executionId}: ${error.message}`);
            }
          }

          // Parsear scenarioTags si existe
          if (firstResult.scenarioTags) {
            try {
              const scenarioTagsString = typeof firstResult.scenarioTags === 'string' 
                ? firstResult.scenarioTags 
                : JSON.stringify(firstResult.scenarioTags);
              const scenarioTags = scenarioTagsString.split(',').map(tag => tag.trim());
              tags = [...new Set([...tags, ...scenarioTags])];
            } catch (error) {
              this.logger.warn(`Error parsing scenario tags for execution ${execution.executionId}: ${error.message}`);
            }
          }
        }

        // Crear estructura anidada de scenarios y examples
        let scenariosStructure: any[] = [];
        let allStepsFlat: any[] = []; // Para mantener compatibilidad con el formato actual
        
                // Agrupar resultados por scenario base
        const scenarioGroups = new Map<string, any[]>();
        
        for (let i = 0; i < allResults.length; i++) {
          const result = allResults[i];
          
          // Acumular scenario tags
          if (result.scenarioTags) {
            try {
              const scenarioTagsString = typeof result.scenarioTags === 'string' 
                ? result.scenarioTags 
                : JSON.stringify(result.scenarioTags);
              const scenarioTags = scenarioTagsString.split(',').map(tag => tag.trim());
              allScenarioTags = [...new Set([...allScenarioTags, ...scenarioTags])];
            } catch (error) {
              this.logger.warn(`Error parsing scenario tags for result ${result.id}: ${error.message}`);
            }
          }

          // Acumular error messages
          if (result.errorMessage) {
            allErrorMessages.push(result.errorMessage);
          }

          // Determinar el nombre base del scenario
          let baseScenarioName = '';
          
          if (execution.testSuiteId && execution.testSuiteId !== 'N/A') {
            // Para test suites, usar los nombres de specificScenario
            const scenarioNames = execution.specificScenario?.split(',').map(s => s.trim()) || [];
            
            // Usar el nombre del scenario del resultado, pero limpiarlo para agrupar
            let resultScenarioName = result.scenarioName || '';
            
            // Si el nombre del resultado incluye "(Example X)", extraer el nombre base
            if (resultScenarioName.includes('(Example')) {
              resultScenarioName = resultScenarioName.split('(Example')[0].trim();
            }
            
            // Buscar el nombre base en la lista de scenarios del test execution
            const matchingScenario = scenarioNames.find(name => 
              resultScenarioName.includes(name) || name.includes(resultScenarioName)
            );
            
            if (matchingScenario) {
              baseScenarioName = matchingScenario;
            } else {
              // Si no encuentra coincidencia, usar el nombre del resultado
              baseScenarioName = resultScenarioName || `Scenario ${scenarioGroups.size + 1}`;
            }
          } else {
            // Para test cases individuales, usar el nombre del scenario sin el sufijo de Example
            baseScenarioName = result.scenarioName || `Scenario ${i + 1}`;
            if (baseScenarioName.includes('(Example')) {
              baseScenarioName = baseScenarioName.split('(Example')[0].trim();
            }
          }
          
          // Agrupar por nombre base del scenario
          if (!scenarioGroups.has(baseScenarioName)) {
            scenarioGroups.set(baseScenarioName, []);
          }
          scenarioGroups.get(baseScenarioName)!.push(result);
        }
        
        // Procesar cada grupo de scenarios
        scenarioGroups.forEach((results, baseScenarioName) => {
          const scenario = {
            scenarioName: baseScenarioName,
            examples: [] as any[]
          };
          
          // Procesar cada resultado (Example) del scenario
          results.forEach((result, exampleIndex) => {
            const example = {
              exampleName: result.scenarioName || `${baseScenarioName} (Example ${exampleIndex + 1})`,
              steps: [] as any[],
              status: result.status,
              duration: result.duration,
              errorMessage: result.errorMessage
            };
            
            // Procesar steps del resultado
            if (result.steps) {
              try {
                const steps = typeof result.steps === 'string' 
                  ? JSON.parse(result.steps) 
                  : result.steps;
                
                if (Array.isArray(steps)) {
                  example.steps = steps;
                  
                  // Agregar steps al array plano para compatibilidad
                  allStepsFlat.push(...steps);
                  
                  // Acumular estadísticas
                  for (const step of steps) {
                    totalSteps++;
                    totalStepDuration += step.duration || 0;
                    
                    switch (step.status) {
                      case 'passed':
                        passedSteps++;
                        break;
                      case 'failed':
                        failedSteps++;
                        break;
                      case 'skipped':
                        skippedSteps++;
                        break;
                    }
                  }
                }
              } catch (error) {
                this.logger.warn(`Error parsing steps for result ${result.id}: ${error.message}`);
              }
            }
            
            scenario.examples.push(example);
          });
          
                    scenariosStructure.push(scenario);
        });
        
        // Usar steps planos para compatibilidad con el formato actual
        allSteps = allStepsFlat;
        
        // Log de la estructura creada
        this.logger.log(`🔍 Estructura de scenarios creada: ${scenariosStructure.length} scenarios, ${allResults.length} total results`);
        this.logger.log(`🔍 Total scenarios esperados: ${execution.totalScenarios}`);
        this.logger.log(`🔍 Specific scenarios: ${execution.specificScenario}`);
        scenariosStructure.forEach((scenario, index) => {
          this.logger.log(`  📋 Scenario ${index + 1}: "${scenario.scenarioName}" - ${scenario.examples.length} examples`);
        });
        
        // Si hay estructura anidada, limpiar allSteps para evitar duplicación
        if (scenariosStructure.length > 0) {
          allSteps = [];
        }

        // Usar información del test case si está disponible
        if (testCase) {
          section = testCase.section || 'N/A';
          testCaseId = testCase.testCaseId || 'N/A';
          testCaseDescription = testCase.description || 'N/A';
          testCaseMethod = testCase.method || 'N/A';
          testCaseTestType = testCase.testType || 'N/A';
          
          // Si no hay tags del resultado, usar los del test case
          if (tags.length === 0 && testCase.tags) {
            try {
              const testCaseTags = typeof testCase.tags === 'string' 
                ? JSON.parse(testCase.tags) 
                : testCase.tags;
              tags = Array.isArray(testCaseTags) ? testCaseTags : [];
            } catch (error) {
              this.logger.warn(`Error parsing test case tags for execution ${execution.executionId}: ${error.message}`);
            }
          }
        }

        // Log final de los IDs que se están enviando
        this.logger.log(`Final testCaseId for execution ${execution.executionId}: ${testCaseId}`);
        this.logger.log(`Final testSuiteId for execution ${execution.executionId}: ${testSuiteId}`);
        return {
          executionId: execution.executionId,
          entityName: execution.entityName,
          status: execution.status,
          startedAt: execution.startedAt,
          completedAt: execution.completedAt,
          executionTime: execution.executionTime,
          totalScenarios: execution.totalScenarios,
          passedScenarios: execution.passedScenarios,
          failedScenarios: execution.failedScenarios,
          // Información adicional
          specificScenario: execution.specificScenario,
          section: section,
          feature: feature,
          scenarioName: scenarioName,
          tags: tags,
          errorMessage: execution.errorMessage,
          metadata: execution.metadata,
          // Información del test case
          testCaseId: testCaseId,
          testCaseDescription: testCaseDescription,
          testSuiteId: testSuiteId,
          testSuiteName: testSuiteName,
          // Estadísticas detalladas de steps
          totalSteps: totalSteps,
          passedSteps: passedSteps,
          failedSteps: failedSteps,
          skippedSteps: skippedSteps,
          totalStepDuration: totalStepDuration,
          averageStepDuration: totalSteps > 0 ? Math.round(totalStepDuration / totalSteps) : 0,
          stepSuccessRate: totalSteps > 0 ? Math.round((passedSteps / totalSteps) * 100) : 0,
          // Información adicional de resultados
          allSteps: allSteps,
          allScenarioTags: allScenarioTags,
          allErrorMessages: allErrorMessages,
          resultsCount: allResults.length,
          // Estructura anidada de scenarios y examples
          scenariosStructure: scenariosStructure,
        };
      })
    );

    return {
      executions: enrichedExecutions,
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

      // Crear un DTO modificado con el entityName correcto y specificScenario actualizado
      const modifiedDto = {
        ...dto,
        entityName: execution.entityName, // Usar el valor guardado en la ejecución
        specificScenario: execution.specificScenario, // Usar el specificScenario actualizado de la ejecución
      };

      let results: any = null;
      let executionError: Error | null = null;

      try {
        // Ejecutar pruebas usando el servicio de runner
        results = await this.testRunnerService.runPlaywrightTests(project.path, modifiedDto);
      } catch (error) {
        executionError = error;
        this.logger.error(`Error en ejecución de pruebas: ${error.message}`);
        
        // Intentar parsear resultados incluso si falló
        try {
          const parsedResults = await this.testRunnerService.parseCucumberOutput(project.path);
          results = {
            results: parsedResults,
            totalScenarios: parsedResults.length,
            passedScenarios: parsedResults.filter(r => r.status === 'passed').length,
            failedScenarios: parsedResults.filter(r => r.status === 'failed').length,
            executionTime: Date.now() - execution.startedAt.getTime(),
          };
          this.logger.log(`Se pudieron parsear ${parsedResults.length} resultados a pesar del error de ejecución`);
        } catch (parseError) {
          this.logger.warn(`No se pudieron parsear resultados: ${parseError.message}`);
          results = { results: [], totalScenarios: 0, passedScenarios: 0, failedScenarios: 0, executionTime: 0 };
        }
      }

      // Actualizar ejecución con resultados (incluso si hubo error)
      if (executionError) {
        execution.status = ExecutionStatus.FAILED;
        execution.errorMessage = executionError.message;
      } else {
        execution.status = ExecutionStatus.COMPLETED;
      }
      
      execution.completedAt = new Date();
      execution.executionTime = results.executionTime || (Date.now() - execution.startedAt.getTime());
      execution.totalScenarios = results.totalScenarios || 0;
      execution.passedScenarios = results.passedScenarios || 0;
      execution.failedScenarios = results.failedScenarios || 0;

      await this.testExecutionRepository.save(execution);

      // Guardar resultados individuales (siempre intentar, incluso si hubo error)
      if (results.results && results.results.length > 0) {
        for (const result of results.results) {
          // Si el escenario tiene múltiples ejecuciones (examples), guardar cada una individualmente
          if (result.hasMultipleExecutions && result.individualExecutions) {
            this.logger.log(`🔍 Guardando ${result.individualExecutions.length} ejecuciones individuales para escenario: ${result.scenarioName}`);
            
            for (const individualExecution of result.individualExecutions) {
              const testResult = this.testResultRepository.create({
                executionId: execution.executionId,
                scenarioName: individualExecution.scenarioInstanceName, // Nombre único por ejemplo
                scenarioTags: individualExecution.scenarioTags,
                status: individualExecution.status,
                duration: individualExecution.duration,
                steps: individualExecution.steps,
                errorMessage: individualExecution.errorMessage,
                metadata: {
                  ...individualExecution.metadata,
                  executionIndex: individualExecution.executionIndex,
                  isExampleExecution: true,
                  originalScenarioName: result.scenarioName,
                  totalExampleExecutions: result.individualExecutions.length,
                },
              });
              await this.testResultRepository.save(testResult);
              this.logger.log(`   ✅ Guardada ejecución ${individualExecution.executionIndex}: ${individualExecution.scenarioInstanceName} - ${individualExecution.status}`);
            }
          } else {
            // Escenario normal (sin examples), guardar como antes
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
        }

        // ✅ NUEVO: Crear bugs automáticamente para todos los test cases fallidos
        try {
          const executionData = {
            executionId: execution.executionId,
            projectName: project.name,
            entityName: execution.entityName,
            method: execution.method,
            environment: execution.metadata?.environment || 'default',
            startedAt: execution.startedAt,
          };

          const createdBugs = await this.bugsService.createBugsFromExecutionResults(
            project.id,
            execution.executionId,
            executionData,
            results.results
          );

          this.logger.log(`Created ${createdBugs.length} bugs automatically from execution ${execution.executionId}`);
        } catch (error) {
          this.logger.warn(`Failed to create bugs automatically: ${error.message}`);
        }

        // ✅ NUEVO: Actualizar test cases con resultados de ejecución
        const testCaseResults: any[] = [];
        for (const result of results.results) {
          if (result.hasMultipleExecutions && result.individualExecutions) {
            // Para escenarios con examples, usar el estado consolidado pero incluir información de ejemplos
            testCaseResults.push({
              scenarioName: result.scenarioName,
              status: result.status, // Estado consolidado (failed si al menos uno falló)
              executionTime: result.duration, // Tiempo total
              errorMessage: result.errorMessage,
              hasExamples: true,
              exampleExecutions: result.individualExecutions.map((exec: any) => ({
                status: exec.status,
                executionTime: exec.duration,
                errorMessage: exec.errorMessage,
              })),
            });
          } else {
            testCaseResults.push({
              scenarioName: result.scenarioName,
              status: result.status,
              executionTime: result.duration,
              errorMessage: result.errorMessage,
            });
          }
        }

        await this.testCaseUpdateService.updateTestCasesWithExecutionResults(
          project.id,
          execution.entityName,
          testCaseResults,
        );
      }

      // ✅ NUEVO: Si la ejecución viene de una test suite, actualizar sus estadísticas
      if (execution.testSuiteId) {
        this.logger.log(`Updating test suite stats for test suite ID: ${execution.testSuiteId}`);
        try {
          await this.testSuitesService.updateTestSuiteExecutionStats(
            project.id,
            execution.testSuiteId,
            {
              totalScenarios: results.totalScenarios || 0,
              passedScenarios: results.passedScenarios || 0,
              failedScenarios: results.failedScenarios || 0,
              executionTime: results.executionTime || 0,
            }
          );
          this.logger.log(`Test suite stats updated successfully for test suite ID: ${execution.testSuiteId}`);
        } catch (error) {
          this.logger.warn(`Error updating test suite stats: ${error.message}`);
        }
      } else {
        this.logger.log('No test suite ID found in execution, skipping test suite stats update');
      }



      // Registrar información de la ejecución completada
      await this.executionLoggerService.logExecutionCompleted(
        project.id,
        execution.entityName,
        {
          executionId: execution.executionId,
          status: execution.status,
          summary: this.calculateSummary(execution),
          results: results.results || [],
        }
      );

      // Emitir evento de ejecución completada o fallida
      if (executionError) {
        this.executionEventsService.emitExecutionFailed(
          execution.executionId,
          project.id,
          executionError.message
        );
      } else {
        this.executionEventsService.emitExecutionCompleted(
          execution.executionId,
          project.id,
          {
            totalScenarios: results.totalScenarios,
            passedScenarios: results.passedScenarios,
            failedScenarios: results.failedScenarios,
            executionTime: results.executionTime,
          }
        );
      }

      if (executionError) {
        this.logger.log(`Ejecución ${execution.executionId} falló pero se guardaron los resultados disponibles`);
        throw executionError; // Re-lanzar el error para que se maneje en el catch externo
      } else {
        this.logger.log(`Ejecución ${execution.executionId} completada exitosamente`);
      }
    } catch (error) {
      this.logger.error(`Error en ejecución ${execution.executionId}:`, error);

      // Solo actualizar si no se actualizó antes
      if (execution.status !== ExecutionStatus.FAILED) {
        execution.status = ExecutionStatus.FAILED;
        execution.errorMessage = error.message;
        execution.completedAt = new Date();
        execution.executionTime = Date.now() - execution.startedAt.getTime();

        await this.testExecutionRepository.save(execution);
      }

      // Emitir evento de ejecución fallida (solo si no se emitió antes)
      this.executionEventsService.emitExecutionFailed(
        execution.executionId,
        project.id,
        error.message
      );
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

  /**
   * Server-Sent Events para ejecuciones en tiempo real
   */
  getExecutionEvents(projectId: string): Observable<MessageEvent> {
    this.logger.log(`SSE stream iniciado para proyecto: ${projectId}`);
    return this.executionEventsService.getExecutionEvents(projectId);
  }

  /**
   * Obtener ejecuciones fallidas por test case ID
   */
  async getFailedExecutionsByTestCaseId(projectId: string, testCaseId: string): Promise<Array<{
    executionId: string;
    testCaseId: string;
    testCaseName: string;
    entityName: string;
    section: string;
    method: string;
    endpoint: string;
    errorMessage: string;
    executionDate: Date;
  }>> {
    this.logger.log(`Getting failed executions for test case: ${testCaseId} in project: ${projectId}`);

    // Buscar ejecuciones fallidas que contengan el test case ID en scenarioName
    const failedExecutions = await this.testExecutionRepository
      .createQueryBuilder('te')
      .leftJoin('te.results', 'tr')
      .where('te.projectId = :projectId', { projectId })
      .andWhere('te.status = :status', { status: ExecutionStatus.FAILED })
      .andWhere('te.testCaseId = :testCaseId', { testCaseId })
      .orderBy('te.startedAt', 'DESC')
      .getMany();

    return failedExecutions.map(execution => ({
      executionId: execution.executionId,
      testCaseId: testCaseId,
      testCaseName: testCaseId, // El nombre se puede obtener del test case si es necesario
      entityName: execution.entityName,
      section: '', // Se puede obtener del test case si es necesario
      method: execution.method || '',
      endpoint: '', // Se puede obtener del test case si es necesario
      errorMessage: execution.errorMessage || 'Test execution failed',
      executionDate: execution.startedAt,
    }));
  }

  /**
   * Obtener la última ejecución de un test suite específico
   */
  async getLastExecutionByTestSuite(projectId: string, testSuiteId: string): Promise<{
    executionId: string;
    status: string;
    startedAt: Date;
    completedAt?: Date;
    executionTime: number;
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    entityName: string;
  }> {
    this.logger.log(`Getting last execution for test suite: ${testSuiteId} in project: ${projectId}`);

    const lastExecution = await this.testExecutionRepository
      .createQueryBuilder('te')
      .where('te.projectId = :projectId', { projectId })
      .andWhere('te.testSuiteId = :testSuiteId', { testSuiteId })
      .orderBy('te.startedAt', 'DESC')
      .getOne();

    if (!lastExecution) {
      throw new NotFoundException(`No execution found for test suite: ${testSuiteId}`);
    }

    return {
      executionId: lastExecution.executionId,
      status: lastExecution.status,
      startedAt: lastExecution.startedAt,
      completedAt: lastExecution.completedAt,
      executionTime: lastExecution.executionTime,
      totalScenarios: lastExecution.totalScenarios,
      passedScenarios: lastExecution.passedScenarios,
      failedScenarios: lastExecution.failedScenarios,
      entityName: lastExecution.entityName,
    };
  }

  /**
   * Obtener la última ejecución de un test case específico
   */
  async getLastExecutionByTestCase(projectId: string, testCaseId: string): Promise<{
    executionId: string;
    status: string;
    startedAt: Date;
    completedAt?: Date;
    executionTime: number;
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    entityName: string;
  }> {
    this.logger.log(`Getting last execution for test case: ${testCaseId} in project: ${projectId}`);

    const lastExecution = await this.testExecutionRepository
      .createQueryBuilder('te')
      .where('te.projectId = :projectId', { projectId })
      .andWhere('te.testCaseId = :testCaseId', { testCaseId })
      .orderBy('te.startedAt', 'DESC')
      .getOne();

    if (!lastExecution) {
      throw new NotFoundException(`No execution found for test case: ${testCaseId}`);
    }

    return {
      executionId: lastExecution.executionId,
      status: lastExecution.status,
      startedAt: lastExecution.startedAt,
      completedAt: lastExecution.completedAt,
      executionTime: lastExecution.executionTime,
      totalScenarios: lastExecution.totalScenarios,
      passedScenarios: lastExecution.passedScenarios,
      failedScenarios: lastExecution.failedScenarios,
      entityName: lastExecution.entityName,
    };
  }

  /**
   * Obtener el nombre de una test suite por su ID
   */
  private async getTestSuiteName(projectId: string, testSuiteId: string): Promise<string | undefined> {
    try {
      // Por ahora, extraer el nombre del testSuiteId
      // Los test suite IDs tienen formato como: SUITE-ECOMMERCE-PRODUCT-001
      // Podemos extraer una parte más legible
      const parts = testSuiteId.split('-');
      if (parts.length >= 3) {
        // Convertir SUITE-ECOMMERCE-PRODUCT-001 a "Ecommerce Product Test Suite"
        const section = parts[1]?.charAt(0).toUpperCase() + parts[1]?.slice(1).toLowerCase();
        const entity = parts[2]?.charAt(0).toUpperCase() + parts[2]?.slice(1).toLowerCase();
        return `${section} ${entity} Test Suite`;
      }
      return testSuiteId;
    } catch (error) {
      this.logger.warn(`Could not get test suite name for ${testSuiteId}: ${error.message}`);
      return testSuiteId;
    }
  }
} 