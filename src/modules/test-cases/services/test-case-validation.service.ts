import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestCase } from '../entities/test-case.entity';
import { TestStep } from '../entities/test-step.entity';
import { CreateTestCaseDto } from '../dto/create-test-case.dto';

@Injectable()
export class TestCaseValidationService {
  private readonly logger = new Logger(TestCaseValidationService.name);

  constructor(
    @InjectRepository(TestCase)
    private readonly testCaseRepository: Repository<TestCase>,
    @InjectRepository(TestStep)
    private readonly testStepRepository: Repository<TestStep>,
  ) {}

  async validateTestCase(dto: CreateTestCaseDto): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    this.logger.log(`Validating test case: ${dto.name}`);

    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validar estructura básica
      if (!dto.name || dto.name.trim().length === 0) {
        errors.push('Test case name is required');
      }

      if (!dto.description || dto.description.trim().length === 0) {
        errors.push('Test case description is required');
      }

      if (!dto.entityName || dto.entityName.trim().length === 0) {
        errors.push('Entity name is required');
      }

      if (!dto.section || dto.section.trim().length === 0) {
        errors.push('Section is required');
      }

      if (!dto.method || dto.method.trim().length === 0) {
        errors.push('HTTP method is required');
      }

      // Validar tags
      if (!dto.tags || dto.tags.length === 0) {
        warnings.push('No tags specified for test case');
      }

      // Validar escenario
      if (!dto.scenario) {
        errors.push('Scenario structure is required');
      } else {
        await this.validateScenario(dto.scenario, errors, warnings);
      }

      // Validar hooks si existen
      if (dto.hooks) {
        await this.validateHooks(dto.hooks, errors, warnings);
      }

      // Validar metadata si existe
      if (dto.metadata) {
        this.validateMetadata(dto.metadata, errors, warnings);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      this.logger.error(`Error validating test case: ${error.message}`, error.stack);
      errors.push(`Validation error: ${error.message}`);
      return {
        isValid: false,
        errors,
        warnings,
      };
    }
  }

  private async validateScenario(
    scenario: any,
    errors: string[],
    warnings: string[]
  ): Promise<void> {
    // Validar estructura del escenario
    if (!scenario.given || !Array.isArray(scenario.given)) {
      errors.push('Scenario must have a "given" array');
    }

    if (!scenario.when || !Array.isArray(scenario.when)) {
      errors.push('Scenario must have a "when" array');
    }

    if (!scenario.then || !Array.isArray(scenario.then)) {
      errors.push('Scenario must have a "then" array');
    }

    // Validar que hay al menos un step en cada sección
    if (scenario.given && scenario.given.length === 0) {
      warnings.push('No Given steps defined');
    }

    if (scenario.when && scenario.when.length === 0) {
      errors.push('At least one When step is required');
    }

    if (scenario.then && scenario.then.length === 0) {
      errors.push('At least one Then step is required');
    }

    // Validar steps individuales
    const allSteps = [
      ...(scenario.given || []),
      ...(scenario.when || []),
      ...(scenario.then || []),
    ];

    for (const step of allSteps) {
      await this.validateStep(step, errors, warnings);
    }
  }

  private async validateStep(
    step: any,
    errors: string[],
    warnings: string[]
  ): Promise<void> {
    if (!step.stepId || step.stepId.trim().length === 0) {
      errors.push('Step ID is required for all steps');
      return;
    }

    // Verificar que el step existe en la base de datos
    const stepExists = await this.testStepRepository.findOne({
      where: { stepId: step.stepId },
    });

    if (!stepExists) {
      errors.push(`Step template ${step.stepId} not found`);
    } else {
      // Validar parámetros si el step los requiere
      if (step.parameters && stepExists.parameters) {
        this.validateStepParameters(step.parameters, stepExists.parameters, errors);
      }
    }

    // Validar orden si se especifica
    if (step.order !== undefined && (step.order < 0 || !Number.isInteger(step.order))) {
      errors.push(`Invalid order value for step ${step.stepId}`);
    }
  }

  private validateStepParameters(
    providedParams: Record<string, any>,
    requiredParams: any[],
    errors: string[]
  ): void {
    for (const requiredParam of requiredParams) {
      if (requiredParam.required && !(requiredParam.name in providedParams)) {
        errors.push(`Required parameter "${requiredParam.name}" missing for step`);
      }
    }
  }

  private async validateHooks(
    hooks: any,
    errors: string[],
    warnings: string[]
  ): Promise<void> {
    if (hooks.before && Array.isArray(hooks.before)) {
      for (const hookId of hooks.before) {
        const hookExists = await this.testStepRepository.findOne({
          where: { stepId: hookId },
        });
        if (!hookExists) {
          errors.push(`Before hook ${hookId} not found`);
        }
      }
    }

    if (hooks.after && Array.isArray(hooks.after)) {
      for (const hookId of hooks.after) {
        const hookExists = await this.testStepRepository.findOne({
          where: { stepId: hookId },
        });
        if (!hookExists) {
          errors.push(`After hook ${hookId} not found`);
        }
      }
    }
  }

  private validateMetadata(
    metadata: any,
    errors: string[],
    warnings: string[]
  ): void {
    if (metadata.estimatedDuration !== undefined) {
      if (metadata.estimatedDuration < 100 || metadata.estimatedDuration > 300000) {
        errors.push('Estimated duration must be between 100ms and 300000ms');
      }
    }

    if (metadata.dependencies && Array.isArray(metadata.dependencies)) {
      for (const dependency of metadata.dependencies) {
        if (!dependency || dependency.trim().length === 0) {
          errors.push('Dependency cannot be empty');
        }
      }
    }
  }

  async validateStepTemplate(stepId: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    this.logger.log(`Validating step template: ${stepId}`);

    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const step = await this.testStepRepository.findOne({
        where: { stepId },
      });

      if (!step) {
        errors.push(`Step template ${stepId} not found`);
        return { isValid: false, errors, warnings };
      }

      // Validar nombre
      if (!step.name || step.name.trim().length === 0) {
        errors.push('Step name is required');
      }

      // Validar definición
      if (!step.definition || step.definition.trim().length === 0) {
        errors.push('Step definition is required');
      }

      // Validar implementación
      if (!step.implementation || step.implementation.trim().length === 0) {
        errors.push('Step implementation is required');
      }

      // Validar parámetros
      if (!step.parameters || !Array.isArray(step.parameters)) {
        errors.push('Step parameters must be an array');
      } else {
        for (const param of step.parameters) {
          if (!param.name || param.name.trim().length === 0) {
            errors.push('Parameter name is required');
          }
          if (!param.type || !['string', 'number', 'boolean', 'object'].includes(param.type)) {
            errors.push('Parameter type must be string, number, boolean, or object');
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      this.logger.error(`Error validating step template: ${error.message}`, error.stack);
      errors.push(`Validation error: ${error.message}`);
      return {
        isValid: false,
        errors,
        warnings,
      };
    }
  }
} 