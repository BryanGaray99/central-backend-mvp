import { Injectable, Logger, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { TestSuite, TestSuiteType, TestSuiteStatus, ExecutionStatus } from '../entities/test-suite.entity';
import { CreateTestSuiteDto } from '../dto/create-test-suite.dto';
import { UpdateTestSuiteDto } from '../dto/update-test-suite.dto';
import { TestSuiteFiltersDto } from '../dto/test-suite-filters.dto';
import { TestSuiteResponseDto } from '../dto/test-suite-response.dto';
import { Project } from '../../projects/project.entity';
import { TestCase } from '../../test-cases/entities/test-case.entity';
import { TestExecutionService } from '../../test-execution/services/test-execution.service';
import { TestType, TestEnvironment } from '../../test-execution/dto/execute-tests.dto';
import { ExecuteTestSuiteDto } from '../dto/execute-test-suite.dto';

@Injectable()
export class TestSuitesService {
  private readonly logger = new Logger(TestSuitesService.name);

  constructor(
    @InjectRepository(TestSuite)
    private readonly testSuiteRepository: Repository<TestSuite>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(TestCase)
    private readonly testCaseRepository: Repository<TestCase>,
    @Inject(forwardRef(() => TestExecutionService))
    private readonly testExecutionService: TestExecutionService,
  ) {}

  async createTestSuite(projectId: string, dto: CreateTestSuiteDto): Promise<TestSuiteResponseDto> {
    this.logger.log(`Creating test suite for project: ${projectId}`);

    // Verify project exists
    const project = await this.projectRepository.findOne({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    // Generate suite ID
    const suiteId = await this.generateSuiteId(project.name, dto.type, dto.section || '', dto.type === TestSuiteType.TEST_SET ? dto.entity : undefined);

    // Get test cases if provided
    let testCases: Array<{
      testCaseId: string;
      name: string;
      entityName: string;
      section: string;
    }> = [];
    if (dto.testCaseIds && dto.testCaseIds.length > 0) {
      const foundTestCases = await this.testCaseRepository.find({
        where: { testCaseId: In(dto.testCaseIds), projectId }
      });
      
      testCases = foundTestCases.map(tc => ({
        testCaseId: tc.testCaseId,
        name: tc.name,
        entityName: tc.entityName,
        section: tc.section
      }));
    }

    // Get test suites if provided (for test plans)
    let testSets: Array<{
      setId: string;
      name: string;
      testCases: string[];
    }> = [];
    let totalTestCasesForPlan = 0;
    
    if (dto.testSuiteIds && dto.testSuiteIds.length > 0 && dto.type === TestSuiteType.TEST_PLAN) {
      this.logger.log(`Creating test plan with test suite IDs: ${dto.testSuiteIds.join(', ')}`);
      
      const foundTestSuites = await this.testSuiteRepository.find({
        where: { suiteId: In(dto.testSuiteIds), projectId, type: TestSuiteType.TEST_SET }
      });
      
      this.logger.log(`Found ${foundTestSuites.length} test suites for test plan`);
      
      testSets = foundTestSuites.map(ts => ({
        setId: ts.suiteId,
        name: ts.name,
        testCases: ts.testCases?.map(tc => tc.testCaseId) || []
      }));
      
      // Calcular total de test cases para el plan
      totalTestCasesForPlan = foundTestSuites.reduce((total, ts) => total + (ts.totalTestCases || 0), 0);
      
      this.logger.log(`Test plan will contain ${testSets.length} test sets with ${totalTestCasesForPlan} total test cases`);
    }

    this.logger.log(`Creating test suite with ${testCases.length} test cases: ${testCases.map(tc => tc.name).join(', ')}`);

    const testSuite = this.testSuiteRepository.create({
      projectId,
      suiteId,
      name: dto.name,
      description: dto.description || '',
      type: dto.type,
      status: TestSuiteStatus.PENDING,
      section: dto.section || '',
      entity: dto.entity || '',
      tags: dto.tags || [],
      testCases,
      testSets,
      totalTestCases: dto.type === TestSuiteType.TEST_PLAN ? totalTestCasesForPlan : testCases.length,
      environment: 'default'
    });

    const savedTestSuite = await this.testSuiteRepository.save(testSuite);
    this.logger.log(`Test suite ${suiteId} created successfully with ${savedTestSuite.totalTestCases} test cases`);
    
    if (dto.type === TestSuiteType.TEST_PLAN) {
      this.logger.log(`Test plan ${suiteId} saved with ${savedTestSuite.testSets?.length || 0} test sets`);
      this.logger.log(`Test plan testSets: ${JSON.stringify(savedTestSuite.testSets)}`);
    }
    
    return this.mapToResponseDto(savedTestSuite);
  }

  async getTestSuites(projectId: string, filters: TestSuiteFiltersDto): Promise<{
    testSuites: TestSuiteResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    this.logger.log(`Getting test suites for project: ${projectId}`);

    const queryBuilder = this.testSuiteRepository.createQueryBuilder('ts')
      .where('ts.projectId = :projectId', { projectId });

    // Apply filters
    if (filters.type) {
      queryBuilder.andWhere('ts.type = :type', { type: filters.type });
    }

    if (filters.status) {
      queryBuilder.andWhere('ts.status = :status', { status: filters.status });
    }

    if (filters.section) {
      queryBuilder.andWhere('ts.section = :section', { section: filters.section });
    }

    if (filters.entity) {
      queryBuilder.andWhere('ts.entity = :entity', { entity: filters.entity });
    }

    if (filters.tags && filters.tags.length > 0) {
      queryBuilder.andWhere('ts.tags && :tags', { tags: filters.tags });
    }

    if (filters.environment) {
      queryBuilder.andWhere('ts.environment = :environment', { environment: filters.environment });
    }

    if (filters.search) {
      queryBuilder.andWhere(
        '(ts.name LIKE :search OR ts.description LIKE :search)',
        { search: `%${filters.search}%` }
      );
    }

    // Apply sorting
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'DESC';
    queryBuilder.orderBy(`ts.${sortBy}`, sortOrder);

    // Apply pagination
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const offset = (page - 1) * limit;

    queryBuilder.skip(offset).take(limit);

    const [testSuites, total] = await queryBuilder.getManyAndCount();

    return {
      testSuites: testSuites.map(ts => this.mapToResponseDto(ts)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getTestSuite(projectId: string, suiteId: string): Promise<TestSuiteResponseDto> {
    this.logger.log(`Getting test suite: ${suiteId} for project: ${projectId}`);

    const testSuite = await this.testSuiteRepository.findOne({
      where: { projectId, suiteId }
    });

    if (!testSuite) {
      throw new NotFoundException(`Test suite with ID ${suiteId} not found`);
    }

    return this.mapToResponseDto(testSuite);
  }

  async updateTestSuite(projectId: string, suiteId: string, dto: UpdateTestSuiteDto): Promise<TestSuiteResponseDto> {
    this.logger.log(`Updating test suite: ${suiteId} for project: ${projectId}`);

    const testSuite = await this.testSuiteRepository.findOne({
      where: { projectId, suiteId }
    });

    if (!testSuite) {
      throw new NotFoundException(`Test suite with ID ${suiteId} not found`);
    }

    // Update basic fields
    if (dto.name !== undefined) testSuite.name = dto.name;
    if (dto.description !== undefined) testSuite.description = dto.description;
    if (dto.type !== undefined) testSuite.type = dto.type;
    if (dto.status !== undefined) testSuite.status = dto.status;
    if (dto.tags !== undefined) testSuite.tags = dto.tags;

    // Update test cases if provided
    if (dto.testCaseIds !== undefined) {
      const foundTestCases = await this.testCaseRepository.find({
        where: { testCaseId: In(dto.testCaseIds), projectId }
      });
      
      testSuite.testCases = foundTestCases.map(tc => ({
        testCaseId: tc.testCaseId,
        name: tc.name,
        entityName: tc.entityName,
        section: tc.section
      }));
      testSuite.totalTestCases = testSuite.testCases.length;
      
      this.logger.log(`Updated test suite ${suiteId} with ${testSuite.totalTestCases} test cases: ${testSuite.testCases.map(tc => tc.name).join(', ')}`);
    }

    // Update test sets if provided (for test plans)
    if (dto.testSuiteIds !== undefined && testSuite.type === TestSuiteType.TEST_PLAN) {
      const foundTestSuites = await this.testSuiteRepository.find({
        where: { suiteId: In(dto.testSuiteIds), projectId, type: TestSuiteType.TEST_SET }
      });
      
      testSuite.testSets = foundTestSuites.map(ts => ({
        setId: ts.suiteId,
        name: ts.name,
        testCases: ts.testCases?.map(tc => tc.testCaseId) || []
      }));
      
      // Actualizar totalTestCases para test plans
      testSuite.totalTestCases = foundTestSuites.reduce((total, ts) => total + (ts.totalTestCases || 0), 0);
      this.logger.log(`Updated test plan ${suiteId} with ${testSuite.totalTestCases} total test cases from ${foundTestSuites.length} test sets`);
    }

    const updatedTestSuite = await this.testSuiteRepository.save(testSuite);
    return this.mapToResponseDto(updatedTestSuite);
  }

  async deleteTestSuite(projectId: string, suiteId: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Deleting test suite: ${suiteId} for project: ${projectId}`);

    const testSuite = await this.testSuiteRepository.findOne({
      where: { projectId, suiteId }
    });

    if (!testSuite) {
      throw new NotFoundException(`Test suite with ID ${suiteId} not found`);
    }

    await this.testSuiteRepository.remove(testSuite);

    return {
      success: true,
      message: `Test suite ${suiteId} deleted successfully`
    };
  }

  async executeTestSuite(projectId: string, suiteId: string, dto?: ExecuteTestSuiteDto): Promise<{
    success: boolean;
    data: {
      executionId: string;
      status: string;
      message: string;
      startedAt: string;
    };
  }> {
    this.logger.log(`Executing test suite: ${suiteId} for project: ${projectId}`);

    const testSuite = await this.testSuiteRepository.findOne({
      where: { projectId, suiteId }
    });

    if (!testSuite) {
      throw new NotFoundException(`Test suite with ID ${suiteId} not found`);
    }

    this.logger.log(`Test suite ${suiteId} details:`);
    this.logger.log(`  - Type: ${testSuite.type}`);
    this.logger.log(`  - Total test cases: ${testSuite.totalTestCases}`);
    
    if (testSuite.type === TestSuiteType.TEST_PLAN) {
      this.logger.log(`  - Test sets array: ${JSON.stringify(testSuite.testSets)}`);
      this.logger.log(`  - Test sets length: ${testSuite.testSets?.length || 0}`);
      
      // Para Test Plans: verificar que tengan test sets
      const actualTestSetsCount = testSuite.testSets?.length || 0;
      
      if (actualTestSetsCount === 0) {
        this.logger.warn(`Test plan ${suiteId} has no test sets to execute. This might be due to:`);
        this.logger.warn(`  1. No test sets were selected during creation`);
        this.logger.warn(`  2. Test sets were not saved correctly`);
        this.logger.warn(`  3. Test sets were removed after creation`);
        
        throw new BadRequestException(`Test plan ${suiteId} has no test sets to execute. Please add test sets to this test plan before executing.`);
      }
    } else {
      this.logger.log(`  - Test cases array: ${JSON.stringify(testSuite.testCases)}`);
      this.logger.log(`  - Test cases length: ${testSuite.testCases?.length || 0}`);
      
      // Para Test Sets: verificar que tengan test cases
      const actualTestCasesCount = testSuite.testCases?.length || 0;
      
      if (actualTestCasesCount === 0) {
        this.logger.warn(`Test set ${suiteId} has no test cases to execute. This might be due to:`);
        this.logger.warn(`  1. No test cases were selected during creation`);
        this.logger.warn(`  2. Test cases were not saved correctly`);
        this.logger.warn(`  3. Test cases were removed after creation`);
        
        throw new BadRequestException(`Test set ${suiteId} has no test cases to execute. Please add test cases to this test set before executing.`);
      }
      
      // Corregir el totalTestCases si está inconsistente (solo para test sets)
      if (testSuite.totalTestCases !== actualTestCasesCount) {
        this.logger.warn(`Fixing inconsistent totalTestCases: ${testSuite.totalTestCases} -> ${actualTestCasesCount}`);
        testSuite.totalTestCases = actualTestCasesCount;
        await this.testSuiteRepository.save(testSuite);
      }
    }

    // Update execution status and timestamps
    testSuite.status = TestSuiteStatus.RUNNING;
    testSuite.startedAt = new Date();
    testSuite.lastExecutedAt = new Date();
    await this.testSuiteRepository.save(testSuite);

    // Generate execution ID
    const executionId = `EXEC-${suiteId}-${Date.now()}`;

    // Guardar el executionId en el campo executionLogs
    testSuite.executionLogs = executionId;
    await this.testSuiteRepository.save(testSuite);

    // Ejecutar las pruebas usando el TestExecutionService
    try {
      if (testSuite.type === TestSuiteType.TEST_PLAN) {
        // Para Test Plans: ejecutar todos los test sets contenidos
        return await this.executeTestPlan(projectId, testSuite, dto);
      } else {
        // Para Test Sets: ejecutar directamente los test cases
        return await this.executeTestSet(projectId, testSuite, dto);
      }
    } catch (error) {
      this.logger.error(`Error executing test suite ${suiteId}: ${error.message}`);
      
      // Revertir el estado si hay error
      testSuite.status = TestSuiteStatus.FAILED;
      await this.testSuiteRepository.save(testSuite);
      
      throw error;
    }
  }

  async getExecutionHistory(projectId: string, suiteId: string): Promise<any[]> {
    this.logger.log(`Getting execution history for test suite: ${suiteId}`);

    const testSuite = await this.testSuiteRepository.findOne({
      where: { projectId, suiteId }
    });

    if (!testSuite) {
      throw new NotFoundException(`Test suite with ID ${suiteId} not found`);
    }

    // Si hay un executionId guardado en executionLogs, obtener los resultados
    if (testSuite!.executionLogs) {
      try {
        // Aquí se integraría con el TestExecutionService para obtener resultados
        // Por ahora retornamos información básica
        return [{
          executionId: testSuite!.executionLogs,
          status: testSuite!.status,
          startedAt: testSuite!.startedAt,
          completedAt: testSuite!.completedAt,
          totalScenarios: testSuite!.totalTestCases,
          passedScenarios: testSuite!.passedTestCases,
          failedScenarios: testSuite!.failedTestCases,
          successRate: testSuite!.totalTestCases > 0 
            ? (testSuite!.passedTestCases / testSuite!.totalTestCases) * 100 
            : 0,
        }];
      } catch (error) {
        this.logger.warn(`Error getting execution results: ${error.message}`);
      }
    }

    return [];
  }

  async getTestSetsBySection(projectId: string, section: string): Promise<TestSuiteResponseDto[]> {
    this.logger.log(`Getting test sets for section: ${section} in project: ${projectId}`);

    const testSets = await this.testSuiteRepository.find({
      where: { 
        projectId, 
        section, 
        type: TestSuiteType.TEST_SET 
      },
      order: { createdAt: 'DESC' }
    });

    return testSets.map(ts => this.mapToResponseDto(ts));
  }

  /**
   * Ejecuta un Test Set (colección de test cases)
   */
  private async executeTestSet(
    projectId: string, 
    testSuite: TestSuite, 
    dto?: ExecuteTestSuiteDto
  ): Promise<{
    success: boolean;
    data: {
      executionId: string;
      status: string;
      message: string;
      startedAt: string;
    };
  }> {
    // Extraer los nombres de los escenarios específicos del test set
    const specificScenarios = testSuite.testCases?.map(tc => tc.name) || [];
    
    this.logger.log(`Test set ${testSuite.suiteId} contains ${specificScenarios.length} specific scenarios: ${specificScenarios.join(', ')}`);
    
    // Preparar los datos para la ejecución
    const executeTestsDto = {
      entityName: testSuite.entity,
      method: dto?.method,
      testType: dto?.testType || TestType.ALL,
      tags: testSuite.tags,
      specificScenario: specificScenarios.length > 0 ? specificScenarios.join(',') : undefined,
      environment: dto?.environment || testSuite.environment as TestEnvironment || TestEnvironment.LOCAL,
      verbose: dto?.verbose ?? true,
      saveLogs: dto?.saveLogs ?? true,
      savePayloads: dto?.savePayloads ?? true,
      parallel: dto?.parallel ?? true,
      timeout: dto?.timeout || 30000,
      retries: dto?.retries || 1,
      workers: dto?.workers || 3,
      testSuiteId: testSuite.suiteId,
    };

    // Llamar al TestExecutionService
    const executionResult = await this.testExecutionService.executeTests(projectId, executeTestsDto);

    this.logger.log(`Test set ${testSuite.suiteId} execution initiated with execution ID: ${executionResult.executionId}`);

    // Esperar un poco para que se complete la ejecución y se actualicen las estadísticas
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verificar que el test set se haya actualizado correctamente
    const updatedTestSet = await this.testSuiteRepository.findOne({
      where: { projectId, suiteId: testSuite.suiteId }
    });

    if (updatedTestSet && updatedTestSet.status !== TestSuiteStatus.RUNNING) {
      this.logger.log(`Test set ${testSuite.suiteId} execution completed with status: ${updatedTestSet.status}`);
    } else {
      this.logger.warn(`Test set ${testSuite.suiteId} still in RUNNING status, may need more time to complete`);
    }

    return {
      success: true,
      data: {
        executionId: executionResult.executionId,
        status: 'started',
        message: `Test set execution completed successfully with ${testSuite.totalTestCases} test cases`,
        startedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Ejecuta un Test Plan (colección de test sets)
   */
  private async executeTestPlan(
    projectId: string, 
    testPlan: TestSuite, 
    dto?: ExecuteTestSuiteDto
  ): Promise<{
    success: boolean;
    data: {
      executionId: string;
      status: string;
      message: string;
      startedAt: string;
    };
  }> {
    this.logger.log(`Executing test plan ${testPlan.suiteId} with ${testPlan.testSets?.length || 0} test sets`);
    this.logger.log(`Test plan testSets: ${JSON.stringify(testPlan.testSets)}`);
    
    // Obtener todos los test sets del plan
    const testSetIds = testPlan.testSets?.map(ts => ts.setId) || [];
    this.logger.log(`Test set IDs to execute: ${testSetIds.join(', ')}`);
    
    if (testSetIds.length === 0) {
      throw new BadRequestException(`Test plan ${testPlan.suiteId} has no test sets to execute`);
    }

    // Obtener los test sets completos de la base de datos
    this.logger.log(`Searching for test sets with IDs: ${testSetIds.join(', ')}`);
    const testSets = await this.testSuiteRepository.find({
      where: { suiteId: In(testSetIds), projectId, type: TestSuiteType.TEST_SET }
    });

    this.logger.log(`Found ${testSets.length} test sets in database: ${testSets.map(ts => ts.suiteId).join(', ')}`);

    if (testSets.length === 0) {
      throw new BadRequestException(`No test sets found for test plan ${testPlan.suiteId}`);
    }

    this.logger.log(`Found ${testSets.length} test sets to execute: ${testSets.map(ts => ts.suiteId).join(', ')}`);

    // Ejecutar cada test set secuencialmente y recolectar resultados
    const executionResults: Array<{
      testSetId: string;
      testSetName: string;
      executionId?: string;
      error?: string;
      status: string;
      passed?: number;
      failed?: number;
      skipped?: number;
      executionTime?: number;
    }> = [];
    let totalTestCases = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let totalExecutionTime = 0;

    for (const testSet of testSets) {
      try {
        this.logger.log(`Executing test set: ${testSet.suiteId}`);
        
        // Ejecutar el test set
        const testSetResult = await this.executeTestSet(projectId, testSet, dto);
        
        // Esperar un poco para que se complete la ejecución
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Obtener el test set actualizado para ver los resultados
        const updatedTestSet = await this.testSuiteRepository.findOne({
          where: { projectId, suiteId: testSet.suiteId }
        });
        
        if (updatedTestSet) {
          executionResults.push({
            testSetId: testSet.suiteId,
            testSetName: testSet.name,
            executionId: testSetResult.data.executionId,
            status: updatedTestSet.status,
            passed: updatedTestSet.passedTestCases || 0,
            failed: updatedTestSet.failedTestCases || 0,
            skipped: updatedTestSet.skippedTestCases || 0,
            executionTime: updatedTestSet.executionTime || 0
          });
          
          // Actualizar contadores del plan
          totalTestCases += updatedTestSet.totalTestCases || 0;
          totalPassed += updatedTestSet.passedTestCases || 0;
          totalFailed += updatedTestSet.failedTestCases || 0;
          totalSkipped += updatedTestSet.skippedTestCases || 0;
          totalExecutionTime += updatedTestSet.executionTime || 0;
          
          this.logger.log(`Test set ${testSet.suiteId} completed with status: ${updatedTestSet.status}`);
        } else {
          executionResults.push({
            testSetId: testSet.suiteId,
            testSetName: testSet.name,
            executionId: testSetResult.data.executionId,
            status: 'unknown'
          });
        }
        
        // Esperar un poco entre ejecuciones para evitar sobrecarga
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        this.logger.error(`Error executing test set ${testSet.suiteId}: ${error.message}`);
        executionResults.push({
          testSetId: testSet.suiteId,
          testSetName: testSet.name,
          error: error.message,
          status: 'failed'
        });
        totalFailed += testSet.totalTestCases || 0;
      }
    }

    // Actualizar las estadísticas del test plan
    testPlan.totalTestCases = totalTestCases;
    testPlan.passedTestCases = totalPassed;
    testPlan.failedTestCases = totalFailed;
    testPlan.skippedTestCases = totalSkipped;
    testPlan.executionTime = totalExecutionTime;
    testPlan.completedAt = new Date();
    
    // Determinar el estado final del test plan
    if (totalFailed > 0) {
      testPlan.status = TestSuiteStatus.FAILED;
    } else if (totalPassed > 0) {
      testPlan.status = TestSuiteStatus.PASSED;
    } else {
      testPlan.status = TestSuiteStatus.SKIPPED;
    }

    // Guardar los resultados de ejecución en el test plan
    testPlan.executionLogs = JSON.stringify({
      planExecutionId: `PLAN-EXEC-${testPlan.suiteId}-${Date.now()}`,
      testSetResults: executionResults,
      totalTestCases,
      totalPassed,
      totalFailed,
      totalSkipped,
      totalExecutionTime,
      startedAt: new Date().toISOString(),
      completedAt: testPlan.completedAt.toISOString()
    });
    
    await this.testSuiteRepository.save(testPlan);

    // Generar un execution ID único para el test plan
    const planExecutionId = `PLAN-EXEC-${testPlan.suiteId}-${Date.now()}`;

    this.logger.log(`Test plan ${testPlan.suiteId} execution completed:`);
    this.logger.log(`  - Total test cases: ${totalTestCases}`);
    this.logger.log(`  - Passed: ${totalPassed}`);
    this.logger.log(`  - Failed: ${totalFailed}`);
    this.logger.log(`  - Skipped: ${totalSkipped}`);
    this.logger.log(`  - Final status: ${testPlan.status}`);
    this.logger.log(`  - Total execution time: ${totalExecutionTime}ms`);

    return {
      success: true,
      data: {
        executionId: planExecutionId,
        status: 'completed',
        message: `Test plan execution completed successfully with ${testSets.length} test sets and ${totalTestCases} total test cases`,
        startedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Actualiza las estadísticas de una test suite basado en los resultados de ejecución
   */
  async updateTestSuiteExecutionStats(
    projectId: string, 
    suiteId: string, 
    executionResults: {
      totalScenarios: number;
      passedScenarios: number;
      failedScenarios: number;
      executionTime: number;
    }
  ): Promise<void> {
    this.logger.log(`Updating execution stats for test suite: ${suiteId}`);

    const testSuite = await this.testSuiteRepository.findOne({
      where: { projectId, suiteId }
    });

    if (!testSuite) {
      throw new NotFoundException(`Test suite with ID ${suiteId} not found`);
    }

    // Actualizar estadísticas
    testSuite.totalTestCases = executionResults.totalScenarios;
    testSuite.passedTestCases = executionResults.passedScenarios;
    testSuite.failedTestCases = executionResults.failedScenarios;
    // Calcular skipped: total - passed - failed (según tu lógica)
    testSuite.skippedTestCases = executionResults.totalScenarios - executionResults.passedScenarios - executionResults.failedScenarios;
    testSuite.executionTime = executionResults.executionTime;
    testSuite.completedAt = new Date();
    
    // Determinar el estado final
    if (executionResults.failedScenarios > 0) {
      testSuite.status = TestSuiteStatus.FAILED;
    } else if (executionResults.passedScenarios > 0) {
      testSuite.status = TestSuiteStatus.PASSED;
    } else {
      testSuite.status = TestSuiteStatus.SKIPPED;
    }

    await this.testSuiteRepository.save(testSuite);
    
    // Log detallado de las estadísticas actualizadas
    this.logger.log(`Test suite ${suiteId} execution stats updated successfully:`);
    this.logger.log(`  - Total scenarios: ${testSuite.totalTestCases}`);
    this.logger.log(`  - Passed scenarios: ${testSuite.passedTestCases}`);
    this.logger.log(`  - Failed scenarios: ${testSuite.failedTestCases}`);
    this.logger.log(`  - Skipped scenarios: ${testSuite.skippedTestCases}`);
    this.logger.log(`  - Final status: ${testSuite.status}`);
    this.logger.log(`  - Execution time: ${testSuite.executionTime}ms`);
  }

  private async generateSuiteId(projectName: string, type: TestSuiteType, section: string, entity?: string): Promise<string> {
    const prefix = type === TestSuiteType.TEST_SET ? 'SUITE' : 'PLAN';
    
    if (type === TestSuiteType.TEST_SET) {
      // Para Test Sets: SUITE-section-entity-number
      const lastTestSuite = await this.testSuiteRepository
        .createQueryBuilder('ts')
        .where('ts.section = :section', { section })
        .andWhere('ts.entity = :entity', { entity })
        .andWhere('ts.type = :type', { type: TestSuiteType.TEST_SET })
        .orderBy('ts.suiteId', 'DESC')
        .getOne();

      let nextId = 1;
      if (lastTestSuite) {
        const match = lastTestSuite.suiteId.match(/-(\d+)$/);
        if (match) {
          nextId = parseInt(match[1]) + 1;
        }
      }

      return `${prefix}-${section.toUpperCase()}-${entity?.toUpperCase()}-${nextId.toString().padStart(3, '0')}`;
    } else {
      // Para Test Plans: PLAN-section-number
      const lastTestPlan = await this.testSuiteRepository
        .createQueryBuilder('ts')
        .where('ts.section = :section', { section })
        .andWhere('ts.type = :type', { type: TestSuiteType.TEST_PLAN })
        .orderBy('ts.suiteId', 'DESC')
        .getOne();

      let nextId = 1;
      if (lastTestPlan) {
        const match = lastTestPlan.suiteId.match(/-(\d+)$/);
        if (match) {
          nextId = parseInt(match[1]) + 1;
        }
      }

      return `${prefix}-${section.toUpperCase()}-${nextId.toString().padStart(3, '0')}`;
    }
  }

  private mapToResponseDto(testSuite: TestSuite): TestSuiteResponseDto {
    return {
      id: testSuite.id,
      suiteId: testSuite.suiteId,
      projectId: testSuite.projectId,
      name: testSuite.name,
      description: testSuite.description,
      type: testSuite.type,
      status: testSuite.status,
      section: testSuite.section,
      entity: testSuite.entity,
      tags: testSuite.tags || [],
      testCases: testSuite.testCases || [],
      testSets: testSuite.testSets || [],
      totalTestCases: testSuite.totalTestCases || 0,
      passedTestCases: testSuite.passedTestCases || 0,
      failedTestCases: testSuite.failedTestCases || 0,
      skippedTestCases: testSuite.skippedTestCases || 0,
      executionTime: testSuite.executionTime || 0,
      lastExecutedAt: testSuite.lastExecutedAt,
      startedAt: testSuite.startedAt,
      completedAt: testSuite.completedAt,
      errors: testSuite.errors || [],
      bugs: testSuite.bugs || [],
      executionLogs: testSuite.executionLogs || '',
      environment: testSuite.environment || 'default',
      createdAt: testSuite.createdAt,
      updatedAt: testSuite.updatedAt
    };
  }
}
