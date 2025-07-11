import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestCase, TestCaseStatus, TestType } from '../entities/test-case.entity';
import { TestStep } from '../entities/test-step.entity';
import { CreateTestCaseDto } from '../dto/create-test-case.dto';
import { UpdateTestCaseDto } from '../dto/update-test-case.dto';
import { TestCaseFiltersDto } from '../dto/test-case-filters.dto';
import { TestCaseListResponse, TestCaseStatistics, TestCaseExport, DuplicateTestCaseDto } from '../interfaces/test-case.interface';
import { FeatureFileManagerService } from './feature-file-manager.service';
import { ProjectMetaService } from '../../endpoints/services/project-meta.service';
import { TestCaseResponseDto } from '../dto/test-case-response.dto';
import { TestCaseListResponseDto, TestCaseStatisticsDto, TestCaseExportDto } from '../dto/test-case-statistics.dto';

@Injectable()
export class TestCasesService {
  private readonly logger = new Logger(TestCasesService.name);

  constructor(
    @InjectRepository(TestCase)
    private readonly testCaseRepository: Repository<TestCase>,
    @InjectRepository(TestStep)
    private readonly testStepRepository: Repository<TestStep>,
    private readonly featureFileManagerService: FeatureFileManagerService,
    private readonly projectMetaService: ProjectMetaService,
  ) {}

  async createTestCase(projectId: string, dto: CreateTestCaseDto): Promise<TestCaseResponseDto> {
    this.logger.log(`Creating test case for project ${projectId}: ${dto.name}`);

    try {
      // 1. Generar ID único del test case
      const testCaseId = await this.generateTestCaseId(projectId, dto.section);
      
      // 2. Validar steps y hooks
      await this.validateTestCase(dto);
      
      // 3. Crear entidad en BD
      const testCase = this.testCaseRepository.create({
        ...dto,
        testCaseId,
        projectId,
      });
      
      const savedTestCase = await this.testCaseRepository.save(testCase);
      
      // 4. Actualizar archivos de feature - DESHABILITADO para evitar duplicación
      // await this.featureFileManagerService.addTestCaseToFeature(
      //   projectId,
      //   dto.section,
      //   dto.entityName,
      //   savedTestCase
      // );
      
      // 5. Actualizar metadata del proyecto
      await this.updateProjectMetadata(projectId, savedTestCase);
      
      this.logger.log(`Test case created successfully: ${testCaseId}`);
      return this.toTestCaseResponseDto(savedTestCase);
    } catch (error) {
      this.logger.error(`Error creating test case: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateTestCase(testCaseId: string, dto: UpdateTestCaseDto): Promise<TestCaseResponseDto> {
    this.logger.log(`Updating test case: ${testCaseId}`);

    try {
      // 1. Obtener test case existente (método interno que devuelve entidad)
      const testCase = await this.findTestCaseEntityById(testCaseId);
      
      // 2. Validar steps si se actualiza el escenario
      if (dto.scenario) {
        await this.validateTestCase({ ...testCase, ...dto });
      }
      
      // 3. Actualizar en BD
      Object.assign(testCase, dto);
      const updatedTestCase = await this.testCaseRepository.save(testCase);
      
      // 4. Actualizar archivos de feature - DESHABILITADO para evitar duplicación
      // await this.featureFileManagerService.updateTestCaseInFeature(
      //   testCase.projectId,
      //   testCase.section,
      //   testCase.entityName,
      //   updatedTestCase
      // );
      
      // 5. Actualizar metadata
      await this.updateProjectMetadata(testCase.projectId, updatedTestCase);
      
      this.logger.log(`Test case updated successfully: ${testCaseId}`);
      return this.toTestCaseResponseDto(updatedTestCase);
    } catch (error) {
      this.logger.error(`Error updating test case: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteTestCase(testCaseId: string): Promise<void> {
    this.logger.log(`Deleting test case: ${testCaseId}`);

    try {
      // 1. Obtener test case (método interno que devuelve entidad)
      const testCase = await this.findTestCaseEntityById(testCaseId);
      
      // 2. Eliminar de BD
      await this.testCaseRepository.remove(testCase);
      
      // 3. Actualizar archivos de feature - DESHABILITADO para evitar duplicación
      // await this.featureFileManagerService.removeTestCaseFromFeature(
      //   testCase.projectId,
      //   testCase.section,
      //   testCase.entityName,
      //   testCase
      // );
      
      // 4. Actualizar metadata
      await this.removeFromProjectMetadata(testCase.projectId, testCase);
      
      this.logger.log(`Test case deleted successfully: ${testCaseId}`);
    } catch (error) {
      this.logger.error(`Error deleting test case: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findByTestCaseId(testCaseId: string): Promise<TestCaseResponseDto> {
    const testCase = await this.findTestCaseEntityById(testCaseId);
    return this.toTestCaseResponseDto(testCase);
  }

  async listTestCases(projectId: string, filters: TestCaseFiltersDto): Promise<TestCaseListResponseDto> {
    this.logger.log(`Listing test cases for project ${projectId} with filters`);

    try {
      const queryBuilder = this.testCaseRepository
        .createQueryBuilder('testCase')
        .where('testCase.projectId = :projectId', { projectId });

      // Aplicar filtros
      if (filters.entityName) {
        queryBuilder.andWhere('testCase.entityName = :entityName', { entityName: filters.entityName });
      }

      if (filters.section) {
        queryBuilder.andWhere('testCase.section = :section', { section: filters.section });
      }

      if (filters.method) {
        queryBuilder.andWhere('testCase.method = :method', { method: filters.method });
      }

      if (filters.testType) {
        queryBuilder.andWhere('testCase.testType = :testType', { testType: filters.testType });
      }

      if (filters.tags && filters.tags.length > 0) {
        queryBuilder.andWhere('testCase.tags @> :tags', { tags: filters.tags });
      }

      if (filters.priority) {
        queryBuilder.andWhere("testCase.metadata->>'priority' = :priority", { priority: filters.priority });
      }

      if (filters.complexity) {
        queryBuilder.andWhere("testCase.metadata->>'complexity' = :complexity", { complexity: filters.complexity });
      }

      if (filters.status) {
        queryBuilder.andWhere('testCase.status = :status', { status: filters.status });
      }

      if (filters.search) {
        queryBuilder.andWhere(
          '(testCase.name ILIKE :search OR testCase.description ILIKE :search)',
          { search: `%${filters.search}%` }
        );
      }

      if (filters.createdAtFrom) {
        queryBuilder.andWhere('testCase.createdAt >= :createdAtFrom', { createdAtFrom: filters.createdAtFrom });
      }

      if (filters.createdAtTo) {
        queryBuilder.andWhere('testCase.createdAt <= :createdAtTo', { createdAtTo: filters.createdAtTo });
      }

      if (filters.updatedAtFrom) {
        queryBuilder.andWhere('testCase.updatedAt >= :updatedAtFrom', { updatedAtFrom: filters.updatedAtFrom });
      }

      if (filters.updatedAtTo) {
        queryBuilder.andWhere('testCase.updatedAt <= :updatedAtTo', { updatedAtTo: filters.updatedAtTo });
      }

      // Ordenamiento
      const sortBy = filters.sortBy || 'createdAt';
      const sortOrder = filters.sortOrder || 'DESC';
      queryBuilder.orderBy(`testCase.${sortBy}`, sortOrder);

      // Paginación
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const offset = (page - 1) * limit;

      queryBuilder.skip(offset).take(limit);

      // Ejecutar consulta
      const [testCases, total] = await queryBuilder.getManyAndCount();

      const totalPages = Math.ceil(total / limit);

      return {
        testCases: testCases.map(tc => this.toTestCaseResponseDto(tc)),
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
        filters,
      };
    } catch (error) {
      this.logger.error(`Error listing test cases: ${error.message}`, error.stack);
      throw error;
    }
  }

  async duplicateTestCase(projectId: string, testCaseId: string, dto: DuplicateTestCaseDto): Promise<TestCaseResponseDto> {
    this.logger.log(`Duplicating test case: ${testCaseId}`);

    try {
      const originalTestCase = await this.findTestCaseEntityById(testCaseId);
      
      // Crear nuevo test case basado en el original
      const newTestCaseData: CreateTestCaseDto = {
        name: dto.newName,
        description: originalTestCase.description,
        entityName: originalTestCase.entityName,
        section: originalTestCase.section,
        method: originalTestCase.method,
        testType: originalTestCase.testType,
        tags: dto.modifications?.tags || originalTestCase.tags,
        scenario: dto.modifications?.scenario ? {
          given: dto.modifications.scenario.given || originalTestCase.scenario.given,
          when: dto.modifications.scenario.when || originalTestCase.scenario.when,
          then: dto.modifications.scenario.then || originalTestCase.scenario.then,
        } : {
          given: originalTestCase.scenario.given,
          when: originalTestCase.scenario.when,
          then: originalTestCase.scenario.then,
        },
        hooks: originalTestCase.hooks,
        examples: originalTestCase.examples,
        metadata: dto.modifications?.metadata || originalTestCase.metadata,
      };

      return await this.createTestCase(projectId, newTestCaseData);
    } catch (error) {
      this.logger.error(`Error duplicating test case: ${error.message}`, error.stack);
      throw error;
    }
  }

  async exportTestCase(projectId: string, testCaseId: string): Promise<TestCaseExportDto> {
    this.logger.log(`Exporting test case: ${testCaseId}`);

    try {
      const testCase = await this.findTestCaseEntityById(testCaseId);
      
      // Generar Gherkin
      const gherkin = await this.generateGherkin(testCase);
      
      return {
        testCaseId: testCase.testCaseId,
        name: testCase.name,
        description: testCase.description,
        tags: testCase.tags,
        gherkin,
        metadata: {
          entityName: testCase.entityName,
          method: testCase.method,
          testType: testCase.testType,
          priority: testCase.metadata?.priority,
          complexity: testCase.metadata?.complexity,
        },
      };
    } catch (error) {
      this.logger.error(`Error exporting test case: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getStatistics(projectId: string): Promise<TestCaseStatisticsDto> {
    this.logger.log(`Getting test case statistics for project ${projectId}`);

    try {
      const [
        totalCases,
        positiveCases,
        negativeCases,
        edgeCases,
        activeCases,
        draftCases,
        deprecatedCases,
      ] = await Promise.all([
        this.testCaseRepository.count({ where: { projectId } }),
        this.testCaseRepository.count({ where: { projectId, testType: TestType.POSITIVE } }),
        this.testCaseRepository.count({ where: { projectId, testType: TestType.NEGATIVE } }),
        this.testCaseRepository.count({ where: { projectId, testType: TestType.EDGE_CASE } }),
        this.testCaseRepository.count({ where: { projectId, status: TestCaseStatus.ACTIVE } }),
        this.testCaseRepository.count({ where: { projectId, status: TestCaseStatus.DRAFT } }),
        this.testCaseRepository.count({ where: { projectId, status: TestCaseStatus.DEPRECATED } }),
      ]);

      // Calcular duración promedio
      const avgDurationResult = await this.testCaseRepository
        .createQueryBuilder('testCase')
        .select('AVG(CAST(testCase.metadata->>\'estimatedDuration\' AS INTEGER))', 'avgDuration')
        .where('testCase.projectId = :projectId', { projectId })
        .andWhere("testCase.metadata->>'estimatedDuration' IS NOT NULL")
        .getRawOne();

      const averageDuration = avgDurationResult?.avgDuration || 0;

      // Obtener última actualización
      const lastUpdatedResult = await this.testCaseRepository
        .createQueryBuilder('testCase')
        .select('MAX(testCase.updatedAt)', 'lastUpdated')
        .where('testCase.projectId = :projectId', { projectId })
        .getRawOne();

      return {
        totalCases,
        positiveCases,
        negativeCases,
        edgeCases,
        activeCases,
        draftCases,
        deprecatedCases,
        averageDuration: Math.round(averageDuration),
        lastUpdated: lastUpdatedResult?.lastUpdated || new Date(),
      };
    } catch (error) {
      this.logger.error(`Error getting test case statistics: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Método interno para obtener entidad TestCase
  private async findTestCaseEntityById(testCaseId: string): Promise<TestCase> {
    const testCase = await this.testCaseRepository.findOne({
      where: { testCaseId },
      relations: ['project'],
    });

    if (!testCase) {
      throw new NotFoundException(`Test case with ID ${testCaseId} not found`);
    }

    return testCase;
  }

  private async generateTestCaseId(projectId: string, section: string): Promise<string> {
    // Use simple ID based on timestamp and section
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    return `tc-${section}-${timestamp}-${randomSuffix}`;
  }

  private async validateTestCase(dto: CreateTestCaseDto | (TestCase & UpdateTestCaseDto)): Promise<void> {
    // Skip validation for all steps - allow any step name
    this.logger.log('Skipping step validation - allowing any step name');
    return;
  }

  private async updateProjectMetadata(projectId: string, testCase: TestCase): Promise<void> {
    try {
      // Esta implementación se completará cuando integremos con ProjectMetaService
      this.logger.log(`Updating project metadata for test case: ${testCase.testCaseId}`);
    } catch (error) {
      this.logger.error(`Error updating project metadata: ${error.message}`, error.stack);
    }
  }

  private async removeFromProjectMetadata(projectId: string, testCase: TestCase): Promise<void> {
    try {
      // Esta implementación se completará cuando integremos con ProjectMetaService
      this.logger.log(`Removing test case from project metadata: ${testCase.testCaseId}`);
    } catch (error) {
      this.logger.error(`Error removing from project metadata: ${error.message}`, error.stack);
    }
  }

  private async generateGherkin(testCase: TestCase): Promise<string> {
    const tags = testCase.tags.map(tag => `@${tag}`).join(' ');
    const scenarioName = testCase.name;
    
    let gherkin = `${tags}\nScenario: ${scenarioName}\n`;
    
    // Agregar steps Given
    for (const step of testCase.scenario.given) {
      gherkin += `  Given ${step.stepId}\n`;
    }
    
    // Agregar steps When
    for (const step of testCase.scenario.when) {
      gherkin += `  When ${step.stepId}\n`;
    }
    
    // Agregar steps Then
    for (const step of testCase.scenario.then) {
      gherkin += `  Then ${step.stepId}\n`;
    }
    
    return gherkin;
  }

  private toTestCaseResponseDto(testCase: TestCase): TestCaseResponseDto {
    return {
      id: testCase.id,
      testCaseId: testCase.testCaseId,
      projectId: testCase.projectId,
      entityName: testCase.entityName,
      section: testCase.section,
      name: testCase.name,
      description: testCase.description,
      tags: testCase.tags,
      method: testCase.method,
      testType: testCase.testType,
      scenario: testCase.scenario,
      hooks: testCase.hooks,
      examples: testCase.examples,
      status: testCase.status,
      metadata: testCase.metadata,
      createdAt: testCase.createdAt,
      updatedAt: testCase.updatedAt,
    };
  }
} 