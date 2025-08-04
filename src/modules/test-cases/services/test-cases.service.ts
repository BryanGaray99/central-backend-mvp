import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestCase, TestCaseStatus, TestType } from '../entities/test-case.entity';
import { TestStep } from '../entities/test-step.entity';
import { CreateTestCaseDto } from '../dto/create-test-case.dto';
import { UpdateTestCaseDto } from '../dto/update-test-case.dto';
import { TestCaseFiltersDto } from '../dto/test-case-filters.dto';
import { TestCaseListResponse, TestCaseStatistics, TestCaseExport } from '../interfaces/test-case.interface';
import { FeatureFileManagerService } from './feature-file-manager.service';
import { TestCaseResponseDto } from '../dto/test-case-response.dto';
import { TestCaseStatisticsDto } from '../dto/test-case-statistics.dto';

// Interfaces temporales para los métodos TODO
interface TestCaseListResponseDto {
  testCases: TestCaseResponseDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: TestCaseFiltersDto;
}

interface TestCaseExportDto {
  testCaseId: string;
  name: string;
  description: string;
  tags: string[];
  gherkin: string;
  metadata: {
    entityName: string;
    method: string;
    testType: string;
    priority?: string;
    complexity?: string;
  };
}

interface DuplicateTestCaseDto {
  newName: string;
  modifications?: {
    tags?: string[];
    metadata?: any;
    scenario?: string;
  };
}

@Injectable()
export class TestCasesService {
  private readonly logger = new Logger(TestCasesService.name);

  constructor(
    @InjectRepository(TestCase)
    private readonly testCaseRepository: Repository<TestCase>,
    @InjectRepository(TestStep)
    private readonly testStepRepository: Repository<TestStep>,
    private readonly featureFileManagerService: FeatureFileManagerService,
  ) {}

  // ✅ MÉTODOS CRUD BÁSICOS EN USO
  async createTestCase(projectId: string, dto: CreateTestCaseDto): Promise<TestCaseResponseDto> {
    this.logger.log(`Creating test case for project ${projectId}`);

    try {
      // 1. Validar datos de entrada
      await this.validateTestCase(dto);

      // 2. Generar ID único
      const testCaseId = await this.generateTestCaseId(projectId, dto.section, dto.entityName);

      // 3. Crear test case en BD
      const testCase = this.testCaseRepository.create({
        testCaseId,
        projectId,
        ...dto,
      });

      const savedTestCase = await this.testCaseRepository.save(testCase);

      // 4. Actualizar archivos de feature - DISABLED
      // await this.featureFileManagerService.addTestCaseToFeature(
      //   projectId,
      //   dto.section,
      //   dto.entityName,
      //   savedTestCase
      // );

      this.logger.log(`Test case created successfully: ${testCaseId}`);
      return this.toTestCaseResponseDto(savedTestCase);
    } catch (error) {
      this.logger.error('Error creating test case:', error);
      throw error;
    }
  }

  async updateTestCase(testCaseId: string, dto: UpdateTestCaseDto): Promise<TestCaseResponseDto> {
    this.logger.log(`Updating test case: ${testCaseId}`);

    try {
      const testCase = await this.findTestCaseEntityById(testCaseId);
      
      // 1. Validar datos de entrada
      await this.validateTestCase({ ...testCase, ...dto });

      // 2. Actualizar en BD
      const updatedTestCase = await this.testCaseRepository.save({
        ...testCase,
        ...dto,
      });

      // 3. Actualizar archivos de feature - DISABLED
      // await this.featureFileManagerService.updateTestCaseInFeature(
      //   testCase.projectId,
      //   testCase.section,
      //   testCase.entityName,
      //   updatedTestCase
      // );

      this.logger.log(`Test case updated successfully: ${testCaseId}`);
      return this.toTestCaseResponseDto(updatedTestCase);
    } catch (error) {
      this.logger.error('Error updating test case:', error);
      throw error;
    }
  }

  async deleteTestCase(testCaseId: string): Promise<void> {
    this.logger.log(`Deleting test case: ${testCaseId}`);

    try {
      const testCase = await this.findTestCaseEntityById(testCaseId);

      // 1. Eliminar de BD
      await this.testCaseRepository.remove(testCase);

      // 2. Actualizar archivos de feature - DISABLED
      // await this.featureFileManagerService.removeTestCaseFromFeature(
      //   testCase.projectId,
      //   testCase.section,
      //   testCase.entityName,
      //   testCase
      // );

      this.logger.log(`Test case deleted successfully: ${testCaseId}`);
    } catch (error) {
      this.logger.error('Error deleting test case:', error);
      throw error;
    }
  }

  async findByTestCaseId(testCaseId: string): Promise<TestCaseResponseDto> {
    const testCase = await this.findTestCaseEntityById(testCaseId);
    return this.toTestCaseResponseDto(testCase);
  }

  async listTestCases(projectId: string, filters: TestCaseFiltersDto): Promise<TestCaseListResponseDto> {
    this.logger.log(`Listing test cases for project ${projectId}`);

    try {
      // Construir query base
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

      if (filters.status) {
        queryBuilder.andWhere('testCase.status = :status', { status: filters.status });
      }

      if (filters.search) {
        queryBuilder.andWhere(
          '(testCase.name LIKE :search OR testCase.description LIKE :search)',
          { search: `%${filters.search}%` }
        );
      }

      if (filters.tags && filters.tags.length > 0) {
        // Buscar test cases que contengan al menos uno de los tags
        const tagConditions = filters.tags.map((_, index) => `testCase.tags LIKE :tag${index}`);
        queryBuilder.andWhere(`(${tagConditions.join(' OR ')})`);
        filters.tags.forEach((tag, index) => {
          queryBuilder.setParameter(`tag${index}`, `%${tag}%`);
        });
      }

      // Aplicar ordenamiento
      const sortBy = filters.sortBy || 'createdAt';
      const sortOrder = filters.sortOrder || 'DESC';
      queryBuilder.orderBy(`testCase.${sortBy}`, sortOrder as 'ASC' | 'DESC');

      // Aplicar paginación
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const offset = (page - 1) * limit;

      queryBuilder.skip(offset).take(limit);

      // Ejecutar query
      const [testCases, total] = await queryBuilder.getManyAndCount();

      // Calcular información de paginación
      const totalPages = Math.ceil(total / limit);

      this.logger.log(`Found ${testCases.length} test cases (total: ${total})`);

      return {
        testCases: testCases.map(testCase => this.toTestCaseResponseDto(testCase)),
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
        filters,
      };
    } catch (error) {
      this.logger.error('Error listing test cases:', error);
      throw error;
    }
  }

  async listAllTestCases(): Promise<TestCase[]> {
    this.logger.log('Listing all test cases across all projects');

    try {
      const testCases = await this.testCaseRepository.find({
        order: { createdAt: 'DESC' },
      });

      this.logger.log(`Found ${testCases.length} test cases globally`);
      return testCases;
    } catch (error) {
      this.logger.error('Error listing all test cases:', error);
      throw error;
    }
  }

  async deleteTestCasesByProjectSectionEntity(projectId: string, section: string, entityName: string): Promise<void> {
    this.logger.log(`Deleting all test cases for projectId=${projectId}, section=${section}, entityName=${entityName}`);
    try {
      await this.testCaseRepository.delete({ projectId, section, entityName });
      this.logger.log(`All test cases deleted for projectId=${projectId}, section=${section}, entityName=${entityName}`);
    } catch (error) {
      this.logger.error('Error deleting test cases by project/section/entity:', error);
      throw error;
    }
  }

  // TODO: FUTURA IMPLEMENTACIÓN CON IA - Duplicar test case con modificaciones inteligentes
  async duplicateTestCase(projectId: string, testCaseId: string, dto: DuplicateTestCaseDto): Promise<TestCaseResponseDto> {
    // TODO: Implementar con IA para duplicación inteligente
    // - Análisis de patrones de modificación
    // - Generación de variaciones automáticas
    // - Optimización de cobertura
    throw new Error('TODO: Implementar con IA - duplicateTestCase');
  }

  // TODO: FUTURA IMPLEMENTACIÓN CON IA - Exportar test case con formato optimizado
  async exportTestCase(projectId: string, testCaseId: string): Promise<TestCaseExportDto> {
    // TODO: Implementar con IA para exportación inteligente
    // - Análisis de formato de exportación
    // - Generación de metadatos optimizados
    // - Validación de compatibilidad
    throw new Error('TODO: Implementar con IA - exportTestCase');
  }

  // TODO: FUTURA IMPLEMENTACIÓN CON IA - Obtener estadísticas avanzadas
  async getStatistics(projectId: string): Promise<TestCaseStatisticsDto> {
    // TODO: Implementar con IA para estadísticas inteligentes
    // - Análisis de patrones de uso
    // - Métricas de cobertura avanzadas
    // - Predicciones de rendimiento
    throw new Error('TODO: Implementar con IA - getStatistics');
  }

  // ✅ MÉTODOS DE SOPORTE EN USO
  private async findTestCaseEntityById(testCaseId: string): Promise<TestCase> {
    const testCase = await this.testCaseRepository.findOne({
      where: { testCaseId },
    });

    if (!testCase) {
      throw new Error(`Test case not found: ${testCaseId}`);
    }

    return testCase;
  }

  private async generateTestCaseId(projectId: string, section: string, entityName: string): Promise<string> {
    // Buscar el patrón correcto: TC-{SECTION}-{ENTITYNAME}-{NUMBER}
    const pattern = `TC-${section.toUpperCase()}-${entityName.toUpperCase()}-`;
    const testCases = await this.testCaseRepository
      .createQueryBuilder('testCase')
      .where('testCase.projectId = :projectId', { projectId })
      .andWhere('testCase.testCaseId LIKE :pattern', { pattern: `${pattern}%` })
      .getMany();
    
    let maxNumber = 0;
    for (const tc of testCases) {
      const match = tc.testCaseId.match(new RegExp(`${pattern}(\\d+)`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) maxNumber = num;
      }
    }
    
    return `TC-${section.toUpperCase()}-${entityName.toUpperCase()}-${String(maxNumber + 1).padStart(2, '0')}`;
  }

  private async validateTestCase(dto: CreateTestCaseDto | (TestCase & UpdateTestCaseDto)): Promise<void> {
    // Validaciones básicas
    if (!dto.name || dto.name.trim().length === 0) {
      throw new Error('Test case name is required');
    }

    if (!dto.description || dto.description.trim().length === 0) {
      throw new Error('Test case description is required');
    }

    if (!dto.entityName || dto.entityName.trim().length === 0) {
      throw new Error('Entity name is required');
    }

    if (!dto.section || dto.section.trim().length === 0) {
      throw new Error('Section is required');
    }

    if (!dto.method || dto.method.trim().length === 0) {
      throw new Error('Method is required');
    }

    if (!dto.tags || dto.tags.length === 0) {
      throw new Error('At least one tag is required');
    }

    if (!dto.scenario || dto.scenario.trim().length === 0) {
      throw new Error('Scenario content is required');
    }
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
      lastRun: testCase.lastRun,
      lastRunStatus: testCase.lastRunStatus,
      metadata: testCase.metadata,
      createdAt: testCase.createdAt,
      updatedAt: testCase.updatedAt,
    };
  }
} 