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
/**
 * Service: TestExecutionService
 *
 * Orchestrates the end-to-end test execution lifecycle: validation, creation of
 * execution records, background run, result persistence, statistics and SSE events.
 */
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

  /**
   * Triggers a new test execution for a project.
   *
   * Creates the execution record, emits a start event, kicks off background run,
   * and returns a receipt with execution info.
   */
  async executeTests(projectId: string, dto: ExecuteTestsDto) {
    let entityName = dto.entityName || 'all';
    this.logger.log(`Starting test execution for entity: ${entityName}`);

    // Validate project exists
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    // If it's a test plan, extract test cases from all test sets
    let specificScenarios = dto.specificScenario;
    
          if (dto.testSuiteId && dto.testSuiteId.startsWith('PLAN-')) {
        this.logger.log(`Detected test plan: ${dto.testSuiteId}`);
        
        // Fetch the test plan to obtain test sets and test cases
        const testPlan = await this.testSuitesService.getTestSuite(projectId, dto.testSuiteId);
        
        if (testPlan && testPlan.testSets) {
          const allTestCases: string[] = [];
          let testPlanEntity = '';
          
          this.logger.log(`🔍 DEBUG Test Plan Structure:`);
          this.logger.log(`  - Test Sets count: ${testPlan.testSets.length}`);
          this.logger.log(`  - First test set: ${JSON.stringify(testPlan.testSets[0])}`);
          
          // For test plans, obtain descriptive NAMES of test cases (IDs are in testSets.testCases)
          for (const testSet of testPlan.testSets) {
            if (testSet.testCases && Array.isArray(testSet.testCases)) {
              // Lookup each test case in DB to obtain its descriptive name
              for (const testCaseId of testSet.testCases) {
                try {
                  // Find test case by ID to obtain its descriptive name
                  const testCase = await this.testCaseRepository.findOne({
                    where: { testCaseId, projectId }
                  });
                  
                  if (testCase && testCase.name) {
                    allTestCases.push(testCase.name);
                    this.logger.log(`🔍 DEBUG Test Case ${testCaseId} -> Name: ${testCase.name}`);
                  } else {
                    this.logger.warn(`⚠️ Test case ${testCaseId} not found or missing name`);
                    // Fallback: use the ID if the name is not found
                    allTestCases.push(testCaseId);
                  }
                  
                  // Determine entity of the test plan based on the first test case
                  if (!testPlanEntity && testCase) {
                    testPlanEntity = testCase.entityName;
                  }
                } catch (error) {
                  this.logger.error(`Error fetching test case ${testCaseId}: ${error.message}`);
                  // Fallback: use the ID if there is an error
                  allTestCases.push(testCaseId);
                }
              }
            }
          }
          
          // Remove duplicates and keep unique test cases only
          const uniqueTestCases = [...new Set(allTestCases)];
          
          if (uniqueTestCases.length > 0) {
            specificScenarios = uniqueTestCases.join(',');
            // Use the entity determined by the test plan instead of 'all'
            if (testPlanEntity) {
              entityName = testPlanEntity;
              this.logger.log(`Test plan ${dto.testSuiteId} uses entity: ${entityName}`);
            }
            this.logger.log(`Test plan ${dto.testSuiteId} contains ${uniqueTestCases.length} unique test cases: ${uniqueTestCases.join(', ')}`);
            this.logger.log(`🔍 DEBUG Specific scenarios for execution: ${specificScenarios}`);
          }
        }
      }

    // If an entity is specified, validate it has test cases
    if (dto.entityName) {
      const hasTestCases = await this.validateEntityHasTestCases(project.path, dto.entityName);
      if (!hasTestCases) {
        throw new BadRequestException(`No test cases found for entity '${dto.entityName}'. Ensure it is registered and has generated test cases.`);
      }
    }

    // Create execution record
    const execution = this.testExecutionRepository.create({
      projectId,
      executionId: uuidv4(),
      entityName: entityName, // Use resolved entity (can be 'Product' instead of 'all' for test plans)
      method: dto.method,
      testType: dto.testType,
      tags: dto.tags,
      specificScenario: specificScenarios, // Use test cases extracted from the test plan
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

    // Emit execution started event
    this.executionEventsService.emitExecutionStarted(
      savedExecution.executionId,
      projectId,
      savedExecution.entityName,
      dto.testSuiteId,
      dto.testCaseId
    );

    // Debug log for test plans
    if (dto.testSuiteId && dto.testSuiteId.startsWith('PLAN-')) {
      this.logger.log(`🔍 DEBUG Test Plan Execution:`);
      this.logger.log(`  - Entity Name: ${savedExecution.entityName}`);
      this.logger.log(`  - Specific Scenarios: ${savedExecution.specificScenario}`);
      this.logger.log(`  - Test Suite ID: ${savedExecution.testSuiteId}`);
    }

    // Execute tests in background
    this.runTestsInBackground(savedExecution, project, dto);

    // Count test cases to be updated
    const testCasesToUpdate = dto.entityName 
      ? await this.countTestCasesForEntity(projectId, dto.entityName)
      : await this.countAllTestCasesForProject(projectId);

    return {
      executionId: savedExecution.executionId,
      status: savedExecution.status,
      message: entityName === 'all'
        ? `Test execution started for all project test cases`
        : `Test execution started for entity '${entityName}'`,
      startedAt: savedExecution.startedAt,
      testCasesToUpdate,
      entityName: savedExecution.entityName,
    };
  }

  /**
   * Retrieves detailed results for a specific execution.
   *
   * @param executionId - Execution identifier
   * @returns Detailed execution payload including summary and enriched results
   */
  async getResults(executionId: string) {
    const execution = await this.testExecutionRepository.findOne({
      where: { executionId },
      relations: ['results'],
    });

    if (!execution) {
      throw new NotFoundException(`Execution with ID ${executionId} not found`);
    }

    const summary = this.calculateSummary(execution);

    // Enrich results with additional information
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
      stepCount: result.steps?.length || 0,
      passedSteps: result.steps?.filter(step => step.status === 'passed').length || 0,
      failedSteps: result.steps?.filter(step => step.status === 'failed').length || 0,
      skippedSteps: result.steps?.filter(step => step.status === 'skipped').length || 0,
      // Statistics excluding hooks
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
      // Additional execution information
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
    // Build base query with project filter
    const query = this.testExecutionRepository.createQueryBuilder('execution')
      .where('execution.projectId = :projectId', { projectId })
      .orderBy('execution.startedAt', 'DESC');

    // Apply filters
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

    // Pagination
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    query.skip(offset).take(limit);

    const [executions, total] = await query.getManyAndCount();

    // Enrich each execution with additional info from results and test cases
    const enrichedExecutions = await Promise.all(
      executions.map(async (execution) => {
        // Get all results to extract additional information
        const allResults = await this.testResultRepository.find({
          where: { executionId: execution.executionId },
          order: { createdAt: 'ASC' }
        });

        // Get first result for basic information
        const firstResult = allResults.length > 0 ? allResults[0] : null;

        // Find corresponding test case using base scenario name (without Example)
        let testCase: any = null;
        if (firstResult) {
          // Get the base scenario name (without Example suffix)
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

        // Extract information from result metadata
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

        // Get the test suite name if it exists
        if (testSuiteId && testSuiteId !== 'N/A') {
          try {
            // Use test suites service to get the name
            const testSuite = await this.testSuitesService.getTestSuite(projectId, testSuiteId);
            if (testSuite && testSuite.name) {
              testSuiteName = testSuite.name;
              this.logger.log(`✅ Test suite name obtained: ${testSuiteName} for ${testSuiteId}`);
            } else {
              this.logger.warn(`⚠️ Test suite ${testSuiteId} found but no name available`);
            }
          } catch (error) {
            this.logger.warn(`Error getting test suite name for ${testSuiteId}: ${error.message}`);
            // Fallback: try to get only the name with a direct query
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

        // Step statistics across all results
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
          
          // Parse metadata if present
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

          // Parse scenarioTags if present
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

        // Create nested structure of scenarios and examples
        let scenariosStructure: any[] = [];
        let allStepsFlat: any[] = []; // For compatibility with current format
        
        // Group results by base scenario
        const scenarioGroups = new Map<string, any[]>();
        
        for (let i = 0; i < allResults.length; i++) {
          const result = allResults[i];
          
          // Accumulate scenario tags
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

          // Accumulate error messages
          if (result.errorMessage) {
            allErrorMessages.push(result.errorMessage);
          }

          // Determine base scenario name
          let baseScenarioName = '';
          
          if (execution.testSuiteId && execution.testSuiteId !== 'N/A') {
            // For test suites, use specificScenario names
            const scenarioNames = execution.specificScenario?.split(',').map(s => s.trim()) || [];
            
            // Use result scenario name, clean to group
            let resultScenarioName = result.scenarioName || '';
            
            // If result name includes "(Example X)", extract base name
            if (resultScenarioName.includes('(Example')) {
              resultScenarioName = resultScenarioName.split('(Example')[0].trim();
            }
            
            // Find base name in the specific scenarios list
            const matchingScenario = scenarioNames.find(name => 
              resultScenarioName.includes(name) || name.includes(resultScenarioName)
            );
            
            if (matchingScenario) {
              baseScenarioName = matchingScenario;
            } else {
              // Fallback to result name if no match
              baseScenarioName = resultScenarioName || `Scenario ${scenarioGroups.size + 1}`;
            }
          } else {
            // For individual test cases, use scenario name without Example suffix
            baseScenarioName = result.scenarioName || `Scenario ${i + 1}`;
            if (baseScenarioName.includes('(Example')) {
              baseScenarioName = baseScenarioName.split('(Example')[0].trim();
            }
          }
          
          // Group by base scenario name
          if (!scenarioGroups.has(baseScenarioName)) {
            scenarioGroups.set(baseScenarioName, []);
          }
          scenarioGroups.get(baseScenarioName)!.push(result);
        }
        
        // Process each scenario group
        scenarioGroups.forEach((results, baseScenarioName) => {
          const scenario = {
            scenarioName: baseScenarioName,
            examples: [] as any[]
          };
          
          // Process each result (Example) of the scenario
          results.forEach((result, exampleIndex) => {
            const example = {
              exampleName: result.scenarioName || `${baseScenarioName} (Example ${exampleIndex + 1})`,
              steps: [] as any[],
              status: result.status,
              duration: result.duration,
              errorMessage: result.errorMessage
            };
            
            // Process steps from the result
            if (result.steps) {
              try {
                const steps = typeof result.steps === 'string' 
                  ? JSON.parse(result.steps) 
                  : result.steps;
                
                if (Array.isArray(steps)) {
                  example.steps = steps;
                  
                  // Add steps to flat array for compatibility
                  allStepsFlat.push(...steps);
                  
                  // Accumulate step statistics
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
        
        // Use flat steps for compatibility with current format
        allSteps = allStepsFlat;
        
        // Log created structure
        this.logger.log(`🔍 Scenario structure created: ${scenariosStructure.length} scenarios, ${allResults.length} total results`);
        this.logger.log(`🔍 Expected total scenarios: ${execution.totalScenarios}`);
        this.logger.log(`🔍 Specific scenarios: ${execution.specificScenario}`);
        scenariosStructure.forEach((scenario, index) => {
          this.logger.log(`  📋 Scenario ${index + 1}: "${scenario.scenarioName}" - ${scenario.examples.length} examples`);
        });
        
        // If nested structure exists, clear allSteps to avoid duplication
        if (scenariosStructure.length > 0) {
          allSteps = [];
        }

        // Use test case information if available
        if (testCase) {
          section = testCase.section || 'N/A';
          testCaseId = testCase.testCaseId || 'N/A';
          testCaseDescription = testCase.description || 'N/A';
          testCaseMethod = testCase.method || 'N/A';
          testCaseTestType = testCase.testType || 'N/A';
          
          // If there are no result tags, use those from the test case
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

        // Final log of the IDs that are being sent
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
          specificScenario: execution.specificScenario,
          section: section,
          feature: feature,
          scenarioName: scenarioName,
          tags: tags,
          errorMessage: execution.errorMessage,
          metadata: execution.metadata,
          // Test case information
          testCaseId: testCaseId,
          testCaseDescription: testCaseDescription,
          testSuiteId: testSuiteId,
          testSuiteName: testSuiteName,
          // Detailed step statistics
          totalSteps: totalSteps,
          passedSteps: passedSteps,
          failedSteps: failedSteps,
          skippedSteps: skippedSteps,
          totalStepDuration: totalStepDuration,
          averageStepDuration: totalSteps > 0 ? Math.round(totalStepDuration / totalSteps) : 0,
          stepSuccessRate: totalSteps > 0 ? Math.round((passedSteps / totalSteps) * 100) : 0,
          // Additional results information
          allSteps: allSteps,
          allScenarioTags: allScenarioTags,
          allErrorMessages: allErrorMessages,
          resultsCount: allResults.length,
          // Nested structure of scenarios and examples
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
      throw new NotFoundException(`Execution with ID ${executionId} not found`);
    }

    // Delete related results
    await this.testResultRepository.delete({ executionId: execution.executionId });

    // Delete execution
    await this.testExecutionRepository.remove(execution);

    this.logger.log(`Execution ${executionId} deleted successfully`);
  }

  /**
   * Retrieves the last 10 executions for a specific entity in a project.
   *
   * @param projectId - Project identifier
   * @param entityName - Entity name
   */
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

  /**
   * Aggregates a summary of executions for a project.
   *
   * @param projectId - Project identifier
   */
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

  /**
   * Aggregates a global summary across all projects.
   */
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

  /**
   * Validates the presence of feature files for the given entity.
   *
   * @param projectPath - Project filesystem path
   * @param entityName - Entity name
   */
  private async validateEntityHasTestCases(projectPath: string, entityName: string): Promise<boolean> {
    // Verify that the feature file exists for the entity
    const featurePath = `${projectPath}/src/features/ecommerce/${entityName.toLowerCase()}.feature`;
    
    try {
      const fs = require('fs');
      return fs.existsSync(featurePath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Executes tests asynchronously and persists the results.
   *
   * Updates execution status/progress, stores result details, creates bugs,
   * updates test suites, logs completion, and emits SSE events.
   */
  private async runTestsInBackground(execution: TestExecution, project: Project, dto: ExecuteTestsDto) {
    try {
      // Update status to running
      execution.status = ExecutionStatus.RUNNING;
      await this.testExecutionRepository.save(execution);

      // Create a modified DTO with the correct entityName and updated specificScenario
      const modifiedDto = {
        ...dto,
        entityName: execution.entityName, // Use the value stored on the execution
        specificScenario: execution.specificScenario, // Use the updated specificScenario from the execution
      };

      let results: any = null;
      let executionError: Error | null = null;

      try {
        // Execute tests using the runner service
        results = await this.testRunnerService.runPlaywrightTests(project.path, modifiedDto);
      } catch (error) {
        executionError = error;
        this.logger.error(`Error during test execution: ${error.message}`);
        
        // Attempt to parse results even if it failed
        try {
          const parsedResults = await this.testRunnerService.parseCucumberOutput(project.path);
          results = {
            results: parsedResults,
            totalScenarios: parsedResults.length,
            passedScenarios: parsedResults.filter(r => r.status === 'passed').length,
            failedScenarios: parsedResults.filter(r => r.status === 'failed').length,
            executionTime: Date.now() - execution.startedAt.getTime(),
          };
          this.logger.log(`Parsed ${parsedResults.length} results despite the execution error`);
        } catch (parseError) {
          this.logger.warn(`Could not parse results: ${parseError.message}`);
          results = { results: [], totalScenarios: 0, passedScenarios: 0, failedScenarios: 0, executionTime: 0 };
        }
      }

      // Update execution with results (even if there was an error)
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

      // Persist individual results (always attempt, even on errors)
      if (results.results && results.results.length > 0) {
        for (const result of results.results) {
          // If the scenario has multiple executions (examples), save each individually
          if (result.hasMultipleExecutions && result.individualExecutions) {
            this.logger.log(`🔍 Saving ${result.individualExecutions.length} individual executions for scenario: ${result.scenarioName}`);
            
            for (const individualExecution of result.individualExecutions) {
              const testResult = this.testResultRepository.create({
                executionId: execution.executionId,
                scenarioName: individualExecution.scenarioInstanceName, // Unique name per example
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
              this.logger.log(`   ✅ Saved execution ${individualExecution.executionIndex}: ${individualExecution.scenarioInstanceName} - ${individualExecution.status}`);
            }
          } else {
            // Normal scenario (no examples), save as before
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

        const testCaseResults: any[] = [];
        for (const result of results.results) {
          if (result.hasMultipleExecutions && result.individualExecutions) {
            // For scenarios with examples, use consolidated status but include example information
            testCaseResults.push({
              scenarioName: result.scenarioName,
              status: result.status, // Consolidated status (failed if at least one failed)
              executionTime: result.duration, // Total time
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



      // Log information for the completed execution
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

      // Emit execution completed or failed event
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
        this.logger.log(`Execution ${execution.executionId} failed but available results were saved`);
        throw executionError; // Re-throw the error to be handled by the outer catch
      } else {
        this.logger.log(`Execution ${execution.executionId} completed successfully`);
      }
    } catch (error) {
      this.logger.error(`Error in execution ${execution.executionId}:`, error);

      // Only update if not already updated
      if (execution.status !== ExecutionStatus.FAILED) {
        execution.status = ExecutionStatus.FAILED;
        execution.errorMessage = error.message;
        execution.completedAt = new Date();
        execution.executionTime = Date.now() - execution.startedAt.getTime();

        await this.testExecutionRepository.save(execution);
      }

      // Emit failed execution event (only if not already emitted)
      this.executionEventsService.emitExecutionFailed(
        execution.executionId,
        project.id,
        error.message
      );
    }
  }

  /**
   * Calculates summary statistics for an execution.
   */
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
   * Counts test cases for a specific entity in a project.
   */
  private async countTestCasesForEntity(projectId: string, entityName: string): Promise<number> {
    return await this.testCaseUpdateService.getTestCasesCount(projectId, entityName);
  }

  /**
   * Counts all test cases for a project.
   */
  private async countAllTestCasesForProject(projectId: string): Promise<number> {
    return await this.testCaseUpdateService.getTestCasesCount(projectId);
  }

  /**
   * Server-Sent Events: provides a real-time execution event stream.
   */
  getExecutionEvents(projectId: string): Observable<MessageEvent> {
    this.logger.log(`SSE stream started for project: ${projectId}`);
    return this.executionEventsService.getExecutionEvents(projectId);
  }

  /**
   * Retrieves failed executions by test case ID.
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

    // Look for failed executions matching the provided testCaseId
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
      testCaseName: testCaseId,
      entityName: execution.entityName,
      section: '',
      method: execution.method || '',
      endpoint: '',
      errorMessage: execution.errorMessage || 'Test execution failed',
      executionDate: execution.startedAt,
    }));
  }

  /**
   * Gets the last execution for a specific test suite.
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
   * Gets the last execution for a specific test case.
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
   * Attempts to derive a human-readable test suite name from its ID.
   */
  private async getTestSuiteName(projectId: string, testSuiteId: string): Promise<string | undefined> {
    try {
      const parts = testSuiteId.split('-');
      if (parts.length >= 3) {
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