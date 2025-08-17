import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestStep, StepType, StepTemplateType, StepStatus, Reusability } from '../entities/test-step.entity';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class CommonHooksRegistrationService {
  private readonly logger = new Logger(CommonHooksRegistrationService.name);

  constructor(
    @InjectRepository(TestStep)
    private readonly testStepRepository: Repository<TestStep>,
  ) {}

  async registerCommonHooksFromFile(projectId: string, hooksFilePath: string): Promise<void> {
    this.logger.log(`Registering common hooks from file: ${hooksFilePath}`);

    try {
      // Leer el archivo hooks.ts
      const hooksContent = await fs.readFile(hooksFilePath, 'utf-8');
      
      // Extraer las funciones step del archivo
      const stepFunctions = this.extractStepFunctions(hooksContent);
      
      // Registrar cada step como common hook
      for (const stepFunction of stepFunctions) {
        await this.registerCommonHook(projectId, stepFunction);
      }

      this.logger.log(`Successfully registered ${stepFunctions.length} common hooks`);
    } catch (error) {
      this.logger.error(`Error registering common hooks: ${error.message}`, error.stack);
      throw error;
    }
  }

  private extractStepFunctions(hooksContent: string): Array<{
    name: string;
    definition: string;
    type: StepType;
    implementation: string;
  }> {
    const stepFunctions: Array<{
      name: string;
      definition: string;
      type: StepType;
      implementation: string;
    }> = [];

    const lines = hooksContent.split('\n');
    let stepNumber = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Buscar definiciones de steps (Given, When, Then, And, But)
      const stepMatch = line.match(/^(Given|When|Then|And|But)\s*\(\s*['"`]([^'"`]+)['"`]/);
      if (stepMatch) {
        const stepType = stepMatch[1] as StepType;
        const stepName = stepMatch[2];
        
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
          name: stepName,
          definition: definition,
          type: stepType,
          implementation: implementation,
        };

        stepFunctions.push(step);
        stepNumber++;
      }
    }

    return stepFunctions;
  }

  private generateStepName(definition: string): string {
    // Convertir la definición en un nombre legible
    return definition
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  private async registerCommonHook(
    projectId: string,
    stepFunction: {
      name: string;
      definition: string;
      type: StepType;
      implementation: string;
    }
  ): Promise<void> {
    try {
      // Generar stepId único
      const stepId = `ST-COMMON-${stepFunction.type.toUpperCase()}-${Date.now()}`;
      
      // Verificar si ya existe por nombre y tipo
      const existingStep = await this.testStepRepository.findOne({
        where: {
          projectId,
          entityName: 'common',
          name: stepFunction.name,
          type: stepFunction.type,
        },
      });

      if (existingStep) {
        this.logger.log(`Common hook already exists: ${stepFunction.name} (${stepFunction.type})`);
        return;
      }

      // Extraer parámetros del step name
      const parameters = this.extractParametersFromStepName(stepFunction.name);

      // Crear nuevo step
      const newStep = this.testStepRepository.create({
        stepId,
        projectId,
        section: 'common',
        entityName: 'common',
        name: stepFunction.name,
        definition: stepFunction.definition,
        type: stepFunction.type,
        stepType: StepTemplateType.PREDEFINED,
        parameters: parameters,
        implementation: stepFunction.implementation,
        status: StepStatus.ACTIVE,
        metadata: {
          category: 'common',
          complexity: 'simple',
          reusability: Reusability.HIGH,
        },
      });

      await this.testStepRepository.save(newStep);
      this.logger.log(`Registered common hook: ${stepFunction.name} (${stepFunction.type})`);
    } catch (error) {
      this.logger.error(`Error registering common hook: ${error.message}`, error.stack);
      throw error;
    }
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

  async updateCommonHooks(projectId: string, hooksFilePath: string): Promise<void> {
    this.logger.log(`Updating common hooks for project: ${projectId}`);

    try {
      // Primero eliminar hooks comunes existentes
      await this.testStepRepository.delete({
        projectId,
        entityName: 'common',
      });

      // Luego registrar los nuevos
      await this.registerCommonHooksFromFile(projectId, hooksFilePath);
    } catch (error) {
      this.logger.error(`Error updating common hooks: ${error.message}`, error.stack);
      throw error;
    }
  }
} 