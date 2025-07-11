import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestStep, StepStatus } from '../entities/test-step.entity';
import { CreateStepDto } from '../dto/create-step.dto';
import { StepTemplateStatisticsDto } from '../dto/test-case-statistics.dto';
import { TestStepResponseDto } from '../dto/step-template-response.dto';
import { StepsFileManagerService } from './steps-file-manager.service';

@Injectable()
export class StepTemplatesService {
  private readonly logger = new Logger(StepTemplatesService.name);

  constructor(
    @InjectRepository(TestStep)
    private readonly testStepRepository: Repository<TestStep>,
    private readonly stepsFileManagerService: StepsFileManagerService,
  ) {}

  async createStepTemplate(projectId: string, dto: CreateStepDto): Promise<TestStepResponseDto> {
    this.logger.log(`Creating step template for project ${projectId}: ${dto.name}`);

    try {
      // 1. Validar código si es custom
      if (dto.stepType === 'custom') {
        await this.validateCustomCode(dto.implementation);
      }
      
      // 2. Generar ID único
      const stepId = await this.generateStepId(projectId, dto.name);
      
      // 3. Crear validaciones automáticas
      const validation = await this.generateStepValidation(dto);
      
      // 4. Crear entidad en BD
      const step = this.testStepRepository.create({
        ...dto,
        stepId,
        projectId,
        validation,
      });
      
      const savedStep = await this.testStepRepository.save(step);
      
      // 5. Actualizar archivo de steps
      await this.stepsFileManagerService.addStepToFile(
        projectId,
        savedStep
      );
      
      this.logger.log(`Step template created successfully: ${stepId}`);
      return this.toTestStepResponseDto(savedStep);
    } catch (error) {
      this.logger.error(`Error creating step template: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateStepTemplate(projectId: string, stepId: string, dto: CreateStepDto): Promise<TestStepResponseDto> {
    this.logger.log(`Updating step template: ${stepId}`);

    try {
      // 1. Obtener step existente
      const step = await this.findStepEntityById(stepId);
      
      // 2. Validar código si se actualiza y es custom
      if (dto.implementation && step.stepType === 'custom') {
        await this.validateCustomCode(dto.implementation);
      }
      
      // 3. Actualizar en BD
      Object.assign(step, dto);
      const updatedStep = await this.testStepRepository.save(step);
      
      // 4. Actualizar archivo de steps
      await this.stepsFileManagerService.updateStepInFile(
        updatedStep
      );
      
      this.logger.log(`Step template updated successfully: ${stepId}`);
      return this.toTestStepResponseDto(updatedStep);
    } catch (error) {
      this.logger.error(`Error updating step template: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteStepTemplate(stepId: string): Promise<void> {
    this.logger.log(`Deleting step template: ${stepId}`);

    try {
      // 1. Obtener step
      const step = await this.findStepEntityById(stepId);
      
      // 2. Verificar que no esté siendo usado
      await this.validateStepNotInUse(stepId);
      
      // 3. Eliminar de BD
      await this.testStepRepository.remove(step);
      
      // 4. Actualizar archivo de steps
      await this.stepsFileManagerService.removeStepFromFile(step);
      
      this.logger.log(`Step template deleted successfully: ${stepId}`);
    } catch (error) {
      this.logger.error(`Error deleting step template: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findByStepId(stepId: string): Promise<TestStepResponseDto> {
    const step = await this.findStepEntityById(stepId);
    return this.toTestStepResponseDto(step);
  }

  async listStepTemplates(projectId: string, filters?: {
    type?: string;
    stepType?: string;
    category?: string;
    status?: string;
    search?: string;
  }): Promise<TestStepResponseDto[]> {
    this.logger.log(`Listing step templates for project ${projectId}`);

    try {
      const queryBuilder = this.testStepRepository
        .createQueryBuilder('step')
        .where('step.projectId = :projectId', { projectId });

      // Aplicar filtros
      if (filters?.type) {
        queryBuilder.andWhere('step.type = :type', { type: filters.type });
      }

      if (filters?.stepType) {
        queryBuilder.andWhere('step.stepType = :stepType', { stepType: filters.stepType });
      }

      if (filters?.category) {
        queryBuilder.andWhere("step.metadata->>'category' = :category", { category: filters.category });
      }

      if (filters?.status) {
        queryBuilder.andWhere('step.status = :status', { status: filters.status });
      }

      if (filters?.search) {
        queryBuilder.andWhere(
          '(step.name ILIKE :search OR step.definition ILIKE :search)',
          { search: `%${filters.search}%` }
        );
      }

      // Ordenar por nombre
      queryBuilder.orderBy('step.name', 'ASC');

      const steps = await queryBuilder.getMany();
      return steps.map(step => this.toTestStepResponseDto(step));
    } catch (error) {
      this.logger.error(`Error listing step templates: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getStepTemplatesByCategory(projectId: string, category: string): Promise<TestStepResponseDto[]> {
    return this.listStepTemplates(projectId, { category });
  }

  async getStepTemplatesByType(projectId: string, type: string): Promise<TestStepResponseDto[]> {
    return this.listStepTemplates(projectId, { type });
  }

  async getStatistics(projectId: string): Promise<StepTemplateStatisticsDto> {
    this.logger.log(`Getting step template statistics for project ${projectId}`);

    try {
      const [
        totalSteps,
        activeSteps,
        deprecatedSteps,
      ] = await Promise.all([
        this.testStepRepository.count({ where: { projectId } }),
        this.testStepRepository.count({ where: { projectId, status: StepStatus.ACTIVE } }),
        this.testStepRepository.count({ where: { projectId, status: StepStatus.DEPRECATED } }),
      ]);

      // Obtener steps más usados (esto requeriría una tabla de uso, por ahora retornamos vacío)
      const mostUsedSteps: Array<{ stepId: string; name: string; usageCount: number }> = [];

      // Obtener última actualización
      const lastUpdatedResult = await this.testStepRepository
        .createQueryBuilder('step')
        .select('MAX(step.updatedAt)', 'lastUpdated')
        .where('step.projectId = :projectId', { projectId })
        .getRawOne();

      return {
        totalSteps,
        activeSteps,
        deprecatedSteps,
        mostUsedSteps,
        lastUpdated: lastUpdatedResult?.lastUpdated || new Date(),
      };
    } catch (error) {
      this.logger.error(`Error getting step template statistics: ${error.message}`, error.stack);
      throw error;
    }
  }

  async validateStep(stepId: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    this.logger.log(`Validating step template: ${stepId}`);

    try {
      const step = await this.findStepEntityById(stepId);
      const errors: string[] = [];
      const warnings: string[] = [];

      // Validar sintaxis
      if (step.validation?.syntax) {
        try {
          // Aquí se ejecutaría la validación de sintaxis
          // Por ahora solo simulamos
          const isValid = true; // await this.executeValidation(step.validation.syntax);
          if (!isValid) {
            errors.push('Syntax validation failed');
          }
        } catch (error) {
          errors.push(`Syntax validation error: ${error.message}`);
        }
      }

      // Validar runtime
      if (step.validation?.runtime) {
        try {
          // Aquí se ejecutaría la validación de runtime
          // Por ahora solo simulamos
          const isValid = true; // await this.executeValidation(step.validation.runtime);
          if (!isValid) {
            errors.push('Runtime validation failed');
          }
        } catch (error) {
          errors.push(`Runtime validation error: ${error.message}`);
        }
      }

      // Validar integración
      if (step.validation?.integration) {
        try {
          // Aquí se ejecutaría la validación de integración
          // Por ahora solo simulamos
          const isValid = true; // await this.executeValidation(step.validation.integration);
          if (!isValid) {
            errors.push('Integration validation failed');
          }
        } catch (error) {
          errors.push(`Integration validation error: ${error.message}`);
        }
      }

      // Validar parámetros requeridos
      const requiredParams = step.parameters.filter(p => p.required);
      if (requiredParams.length === 0) {
        warnings.push('No required parameters defined');
      }

      // Validar implementación
      if (step.implementation.trim().length === 0) {
        errors.push('Implementation is empty');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      this.logger.error(`Error validating step template: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Método interno para obtener entidad TestStep
  private async findStepEntityById(stepId: string): Promise<TestStep> {
    const step = await this.testStepRepository.findOne({
      where: { stepId },
      relations: ['project'],
    });

    if (!step) {
      throw new NotFoundException(`Step template with ID ${stepId} not found`);
    }

    return step;
  }

  private async generateStepId(projectId: string, stepName: string | undefined): Promise<string> {
    // Use simple ID based on step name and timestamp
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const stepNameClean = stepName?.replace(/\s+/g, '-').toLowerCase() || 'step';
    return `step-${stepNameClean}-${timestamp}-${randomSuffix}`;
  }

  private extractStepType(stepName: string | undefined): string {
    if (!stepName) return 'GENERIC';
    const lowerName = stepName.toLowerCase();
    
    if (lowerName.includes('create')) return 'CREATE';
    if (lowerName.includes('get') || lowerName.includes('read')) return 'READ';
    if (lowerName.includes('update')) return 'UPDATE';
    if (lowerName.includes('delete')) return 'DELETE';
    if (lowerName.includes('valid')) return 'VALID';
    if (lowerName.includes('invalid')) return 'INVALID';
    if (lowerName.includes('success')) return 'SUCCESS';
    if (lowerName.includes('error')) return 'ERROR';
    if (lowerName.includes('setup')) return 'SETUP';
    if (lowerName.includes('cleanup')) return 'CLEANUP';
    if (lowerName.includes('verify')) return 'VERIFY';
    if (lowerName.includes('check')) return 'CHECK';
    if (lowerName.includes('assert')) return 'ASSERT';
    if (lowerName.includes('expect')) return 'EXPECT';
    
    return 'GENERIC';
  }

  private async validateCustomCode(code: string): Promise<void> {
    // Lista de funciones permitidas
    const allowedFunctions = [
      'expect', 'toBe', 'toBeDefined', 'toBeGreaterThan', 'toBeLessThan',
      'toHaveProperty', 'toMatch', 'toEqual', 'toContain', 'toBeNull',
      'toBeUndefined', 'toBeTruthy', 'toBeFalsy', 'toThrow', 'toHaveLength',
      'toBeCloseTo', 'toBeInstanceOf', 'toHaveBeenCalled', 'toHaveBeenCalledWith',
      'console.log', 'console.error', 'console.warn',
      'this', 'await', 'async', 'function', 'const', 'let', 'var',
      'if', 'else', 'for', 'while', 'switch', 'case', 'default',
      'try', 'catch', 'finally', 'throw', 'return',
    ];

    // Sanitizar código - verificar que no contenga funciones peligrosas
    const dangerousPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /setTimeout\s*\(/,
      /setInterval\s*\(/,
      /process\./,
      /require\s*\(/,
      /import\s*\(/,
      /__dirname/,
      /__filename/,
      /global\s*\./,
      /window\s*\./,
      /document\s*\./,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        throw new BadRequestException('Code contains disallowed functions or patterns');
      }
    }

    // Verificar que el código sea sintácticamente válido
    try {
      // Aquí se podría usar un parser de JavaScript para validar sintaxis
      // Por ahora solo verificamos que no esté vacío
      if (!code.trim()) {
        throw new BadRequestException('Code cannot be empty');
      }
    } catch (error) {
      throw new BadRequestException(`Invalid code syntax: ${error.message}`);
    }
  }

  private async generateStepValidation(dto: CreateStepDto): Promise<any> {
    return {
      syntax: {
        testCode: `const step = new Step('${dto.name}'); expect(step.isValid()).toBe(true);`,
        expectedResult: true,
        timeout: 1000,
      },
      runtime: {
        testCode: `await step.execute(${JSON.stringify(dto.parameters)}); expect(step.result).toBeDefined();`,
        expectedResult: 'defined',
        timeout: 5000,
      },
    };
  }

  private async validateStepNotInUse(stepId: string): Promise<void> {
    // Esta validación requeriría una consulta a la tabla de test cases
    // para verificar que el step no esté siendo usado
    // Por ahora solo simulamos la validación
    
    // const usageCount = await this.testCaseRepository.count({
    //   where: `scenario->>'given' @> '[{"stepId": "${stepId}"}]' OR scenario->>'when' @> '[{"stepId": "${stepId}"}]' OR scenario->>'then' @> '[{"stepId": "${stepId}"}]'`
    // });
    
    // if (usageCount > 0) {
    //   throw new BadRequestException(`Cannot delete step template ${stepId} as it is being used by ${usageCount} test case(s)`);
    // }
  }

  private toTestStepResponseDto(step: TestStep): TestStepResponseDto {
    return {
      id: step.id,
      stepId: step.stepId,
      projectId: step.projectId,
      name: step.name,
      definition: step.definition,
      type: step.type,
      stepType: step.stepType,
      parameters: step.parameters,
      implementation: step.implementation,
      validation: step.validation,
      status: step.status,
      metadata: step.metadata,
      createdAt: step.createdAt,
      updatedAt: step.updatedAt,
    };
  }
} 