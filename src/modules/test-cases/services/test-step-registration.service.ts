import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestStep, StepType, StepTemplateType, StepStatus } from '../entities/test-step.entity';
import { Project } from '../../projects/project.entity';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class TestStepRegistrationService {
  private readonly logger = new Logger(TestStepRegistrationService.name);

  constructor(
    @InjectRepository(TestStep)
    private readonly testStepRepository: Repository<TestStep>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  async processStepsFileAndRegisterSteps(
    projectId: string,
    section: string,
    entityName: string,
  ): Promise<void> {
    try {
      const project = await this.projectRepository.findOne({ where: { id: projectId } });
      if (!project) throw new Error(`Project with ID ${projectId} not found`);

      const stepsFilePath = path.join(
        project.path,
        'src',
        'steps',
        section,
        `${entityName.toLowerCase()}.steps.ts`
      );

      const stepsContent = await fs.readFile(stepsFilePath, 'utf-8');
      const lines = stepsContent.split('\n');

      const steps = this.extractStepsFromFile(lines, projectId, section, entityName);
      
      for (const step of steps) {
        await this.createStepFromFile(step);
      }

      this.logger.log(`Registered ${steps.length} steps for ${entityName} in section ${section}`);
    } catch (error) {
      this.logger.error(`Error processing steps file:`, error);
      throw error;
    }
  }

  private extractStepsFromFile(
    lines: string[],
    projectId: string,
    section: string,
    entityName: string,
  ): Array<{
    projectId: string;
    section: string;
    entityName: string;
    stepId: string;
    name: string;
    definition: string;
    type: StepType;
    implementation: string;
    parameters: any[];
  }> {
    const steps: Array<{
      projectId: string;
      section: string;
      entityName: string;
      stepId: string;
      name: string;
      definition: string;
      type: StepType;
      implementation: string;
      parameters: any[];
    }> = [];

    let stepNumber = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Buscar definiciones de steps (Given, When, Then, And, But)
      const stepMatch = line.match(/^(Given|When|Then|And|But)\s*\(\s*['"`]([^'"`]+)['"`]/);
      if (stepMatch) {
        const stepType = stepMatch[1] as StepType;
        const stepName = stepMatch[2];
        const stepId = `ST-${section.toUpperCase()}-${entityName.toUpperCase()}-${String(stepNumber).padStart(2, '0')}`;

        // Extraer la implementación completa del step
        let implementation = '';
        let definition = '';
        let braceCount = 0;
        let startIndex = i;

        // Buscar desde la línea actual hasta encontrar el cierre del step
        for (let j = i; j < lines.length; j++) {
          const funcLine = lines[j];
          
          // Contar llaves de apertura y cierre
          for (let char of funcLine) {
            if (char === '{') {
              braceCount++;
            } else if (char === '}') {
              braceCount--;
            }
          }

          // Si encontramos el cierre del step (});)
          if (funcLine.includes('});') && braceCount === 0) {
            // Extraer toda la implementación desde la línea de definición hasta el cierre
            implementation = lines.slice(i, j + 1).join('\n');
            definition = implementation; // La definición completa es igual a la implementación
            break;
          }
        }

        // Si no se encontró implementación, crear una básica
        if (!implementation) {
          implementation = `function () { }`;
          definition = `${stepType}('${stepName}', function () { });`;
        }

        const step = {
          projectId,
          section,
          entityName,
          stepId,
          name: stepName,
          definition: definition,
          type: stepType,
          implementation: implementation,
          parameters: this.extractParametersFromStepName(stepName),
        };

        steps.push(step);
        stepNumber++;
      }
    }

    return steps;
  }

  private extractParametersFromStepName(stepName: string): any[] {
    const parameters: any[] = [];
    
    // Buscar parámetros en el formato {string}, {number}, etc.
    const paramMatches = stepName.match(/\{([^}]+)\}/g);
    if (paramMatches) {
      paramMatches.forEach((match, index) => {
        const paramName = match.replace(/\{|\}/g, '');
        parameters.push({
          name: paramName,
          type: 'string', // Por defecto string, se puede mejorar
          required: true,
          defaultValue: undefined,
        });
      });
    }

    return parameters;
  }

  private async createStepFromFile(stepData: {
    projectId: string;
    section: string;
    entityName: string;
    stepId: string;
    name: string;
    definition: string;
    type: StepType;
    implementation: string;
    parameters: any[];
  }): Promise<void> {
    // Verificar si el step ya existe
    const existingStep = await this.testStepRepository.findOne({
      where: { stepId: stepData.stepId },
    });

    if (existingStep) {
      this.logger.log(`Step ${stepData.stepId} already exists, skipping...`);
      return;
    }

    const testStep = this.testStepRepository.create({
      stepId: stepData.stepId,
      projectId: stepData.projectId,
      section: stepData.section,
      entityName: stepData.entityName,
      name: stepData.name,
      definition: stepData.definition,
      type: stepData.type,
      stepType: StepTemplateType.PREDEFINED,
      parameters: stepData.parameters,
      implementation: stepData.implementation,
      status: StepStatus.ACTIVE,
    });

    await this.testStepRepository.save(testStep);
    this.logger.log(`Registered step: ${stepData.stepId} - ${stepData.name}`);
  }

  async getNextStepNumber(projectId: string, section: string, entityName: string): Promise<number> {
    const pattern = `ST-${section.toUpperCase()}-${entityName.toUpperCase()}-`;
    const steps = await this.testStepRepository
      .createQueryBuilder('step')
      .where('step.projectId = :projectId', { projectId })
      .andWhere('step.stepId LIKE :pattern', { pattern: `${pattern}%` })
      .getMany();
    
    let maxNumber = 0;
    for (const step of steps) {
      const match = step.stepId.match(new RegExp(`${pattern}(\\d+)`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) maxNumber = num;
      }
    }
    return maxNumber + 1;
  }

  async deleteTestStepsByProjectSectionEntity(projectId: string, section: string, entityName: string): Promise<void> {
    this.logger.log(`Deleting all test steps for projectId=${projectId}, section=${section}, entityName=${entityName}`);
    try {
      await this.testStepRepository.delete({ projectId, section, entityName });
      this.logger.log(`All test steps deleted for projectId=${projectId}, section=${section}, entityName=${entityName}`);
    } catch (error) {
      this.logger.error('Error deleting test steps by project/section/entity:', error);
      throw error;
    }
  }

  async listTestSteps(
    projectId: string,
    filters: any,
  ): Promise<{
    testSteps: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    filters: any;
  }> {
    this.logger.log(`Listing test steps for projectId=${projectId} with filters:`, filters);
    
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;
    
    // Construir query con filtros
    const queryBuilder = this.testStepRepository
      .createQueryBuilder('step')
      .where('step.projectId = :projectId', { projectId });

    if (filters.section) {
      queryBuilder.andWhere('step.section = :section', { section: filters.section });
    }

    if (filters.entityName) {
      queryBuilder.andWhere('step.entityName = :entityName', { entityName: filters.entityName });
    }

    if (filters.type) {
      queryBuilder.andWhere('step.type = :type', { type: filters.type });
    }

    if (filters.status) {
      queryBuilder.andWhere('step.status = :status', { status: filters.status });
    }

    if (filters.search) {
      queryBuilder.andWhere(
        '(step.name LIKE :search OR step.definition LIKE :search)',
        { search: `%${filters.search}%` }
      );
    }

    // Contar total
    const total = await queryBuilder.getCount();

    // Aplicar ordenamiento
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'DESC';
    queryBuilder.orderBy(`step.${sortBy}`, sortOrder);

    // Aplicar paginación
    queryBuilder.skip(skip).take(limit);

    // Ejecutar query
    const testSteps = await queryBuilder.getMany();

    const totalPages = Math.ceil(total / limit);

    return {
      testSteps,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      filters,
    };
  }

  async getStatistics(projectId: string): Promise<{
    totalSteps: number;
    activeSteps: number;
    deprecatedSteps: number;
    stepsByType: Record<string, number>;
    stepsBySection: Record<string, number>;
    stepsByEntity: Record<string, number>;
    lastUpdated: Date;
  }> {
    this.logger.log(`Getting statistics for projectId=${projectId}`);

    const totalSteps = await this.testStepRepository.count({ where: { projectId } });
    const activeSteps = await this.testStepRepository.count({ where: { projectId, status: StepStatus.ACTIVE } });
    const deprecatedSteps = await this.testStepRepository.count({ where: { projectId, status: StepStatus.DEPRECATED } });

    // Steps por tipo
    const stepsByType = await this.testStepRepository
      .createQueryBuilder('step')
      .select('step.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('step.projectId = :projectId', { projectId })
      .groupBy('step.type')
      .getRawMany();

    // Steps por sección
    const stepsBySection = await this.testStepRepository
      .createQueryBuilder('step')
      .select('step.section', 'section')
      .addSelect('COUNT(*)', 'count')
      .where('step.projectId = :projectId', { projectId })
      .groupBy('step.section')
      .getRawMany();

    // Steps por entidad
    const stepsByEntity = await this.testStepRepository
      .createQueryBuilder('step')
      .select('step.entityName', 'entityName')
      .addSelect('COUNT(*)', 'count')
      .where('step.projectId = :projectId', { projectId })
      .groupBy('step.entityName')
      .getRawMany();

    // Última actualización
    const lastUpdated = await this.testStepRepository
      .createQueryBuilder('step')
      .select('MAX(step.updatedAt)', 'lastUpdated')
      .where('step.projectId = :projectId', { projectId })
      .getRawOne();

    return {
      totalSteps,
      activeSteps,
      deprecatedSteps,
      stepsByType: stepsByType.reduce((acc, item) => {
        acc[item.type] = parseInt(item.count);
        return acc;
      }, {} as Record<string, number>),
      stepsBySection: stepsBySection.reduce((acc, item) => {
        acc[item.section] = parseInt(item.count);
        return acc;
      }, {} as Record<string, number>),
      stepsByEntity: stepsByEntity.reduce((acc, item) => {
        acc[item.entityName] = parseInt(item.count);
        return acc;
      }, {} as Record<string, number>),
      lastUpdated: lastUpdated?.lastUpdated || new Date(),
    };
  }

  async findByStepId(stepId: string): Promise<any> {
    this.logger.log(`Finding test step by stepId=${stepId}`);
    
    const testStep = await this.testStepRepository.findOne({
      where: { stepId },
    });

    if (!testStep) {
      throw new Error(`Test step with stepId ${stepId} not found`);
    }

    return testStep;
  }

  async deleteTestStep(stepId: string): Promise<void> {
    this.logger.log(`Deleting test step with stepId=${stepId}`);
    
    const testStep = await this.testStepRepository.findOne({
      where: { stepId },
    });

    if (!testStep) {
      throw new Error(`Test step with stepId ${stepId} not found`);
    }

    await this.testStepRepository.remove(testStep);
    this.logger.log(`Test step ${stepId} deleted successfully`);
  }
} 