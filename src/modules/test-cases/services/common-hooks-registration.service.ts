import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestStep, StepType, StepTemplateType, StepStatus, Reusability } from '../entities/test-step.entity';
import * as fs from 'fs/promises';

/**
 * Common Hooks Registration Service
 *
 * This service handles the registration and management of common hooks from hooks.ts files.
 * It extracts step functions from Playwright hooks files and registers them as reusable
 * test steps in the database for use across multiple test cases.
 *
 * @class CommonHooksRegistrationService
 * @since 1.0.0
 */
@Injectable()
export class CommonHooksRegistrationService {
  private readonly logger = new Logger(CommonHooksRegistrationService.name);

  constructor(
    @InjectRepository(TestStep)
    private readonly testStepRepository: Repository<TestStep>,
  ) {}

  /**
   * Registers common hooks from a hooks.ts file.
   *
   * This method reads a Playwright hooks file, extracts step functions,
   * and registers them as reusable test steps in the database.
   *
   * @param projectId - The ID of the project to register hooks for
   * @param hooksFilePath - Path to the hooks.ts file to process
   * @returns Promise that resolves when all hooks are registered
   * @throws Error when file reading or registration fails
   *
   * @example
   * ```typescript
   * await commonHooksService.registerCommonHooksFromFile('project-123', '/path/to/hooks.ts');
   * ```
   */
  async registerCommonHooksFromFile(projectId: string, hooksFilePath: string): Promise<void> {
    this.logger.log(`Registering common hooks from file: ${hooksFilePath}`);

    try {
      // Read the hooks.ts file
      const hooksContent = await fs.readFile(hooksFilePath, 'utf-8');
      
      // Extract step functions from the file
      const stepFunctions = this.extractStepFunctions(hooksContent);
      
      // Register each step as a common hook
      for (const stepFunction of stepFunctions) {
        await this.registerCommonHook(projectId, stepFunction);
      }

      this.logger.log(`Successfully registered ${stepFunctions.length} common hooks`);
    } catch (error) {
      this.logger.error(`Error registering common hooks: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Extracts step functions from hooks file content.
   *
   * This private method parses the hooks file content to find and extract
   * step definitions (Given, When, Then, And, But) along with their implementations.
   *
   * @private
   * @param hooksContent - The content of the hooks.ts file
   * @returns Array of extracted step functions with metadata
   */
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

      // Search for step definitions (Given, When, Then, And, But)
      const stepMatch = line.match(/^(Given|When|Then|And|But)\s*\(\s*['"`]([^'"`]+)['"`]/);
      if (stepMatch) {
        const stepType = stepMatch[1] as StepType;
        const stepName = stepMatch[2];
        
        // Extract the complete implementation of the step
        let implementation = '';
        let definition = '';
        let braceCount = 0;
        let startIndex = i;

        // Search from the current line until finding the step closure
        for (let j = i; j < lines.length; j++) {
          const funcLine = lines[j];
          
          // Count opening and closing braces
          for (let char of funcLine) {
            if (char === '{') {
              braceCount++;
            } else if (char === '}') {
              braceCount--;
            }
          }

          // If we find the step closure (});)
          if (funcLine.includes('});') && braceCount === 0) {
            // Extract the entire implementation from the definition line to the closure
            implementation = lines.slice(i, j + 1).join('\n');
            definition = implementation; // The complete definition equals the implementation
            break;
          }
        }

        // If no implementation was found, create a basic one
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

  /**
   * Generates a readable step name from a step definition.
   *
   * This private method converts a step definition string into a clean,
   * readable name by removing special characters and formatting it properly.
   *
   * @private
   * @param definition - The step definition string
   * @returns A formatted, readable step name
   */
  private generateStepName(definition: string): string {
    // Convert the definition into a readable name
    return definition
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Registers a single common hook as a test step.
   *
   * This private method creates a new test step record in the database
   * for a common hook, including parameter extraction and metadata setup.
   *
   * @private
   * @param projectId - The ID of the project to register the hook for
   * @param stepFunction - The step function data to register
   * @returns Promise that resolves when the hook is registered
   * @throws Error when database operations fail
   */
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
      // Generate unique stepId
      const stepId = `ST-COMMON-${stepFunction.type.toUpperCase()}-${Date.now()}`;
      
      // Check if it already exists by name and type
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

      // Extract parameters from step name
      const parameters = this.extractParametersFromStepName(stepFunction.name);

      // Create new step
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

  /**
   * Extracts parameters from a step name definition.
   *
   * This private method parses step names to find parameter placeholders
   * in the format {paramName} and creates parameter definitions for them.
   *
   * @private
   * @param stepName - The step name containing parameter placeholders
   * @returns Array of parameter definitions
   */
  private extractParametersFromStepName(stepName: string): any[] {
    const parameters: any[] = [];
    
    // Search for parameters in the format {string}, {number}, etc.
    const paramMatches = stepName.match(/\{([^}]+)\}/g);
    if (paramMatches) {
      paramMatches.forEach((match, index) => {
        const paramName = match.replace(/\{|\}/g, '');
        parameters.push({
          name: paramName,
          type: 'string', // Default to string, can be improved
          required: true,
          defaultValue: undefined,
        });
      });
    }

    return parameters;
  }

  /**
   * Updates common hooks by replacing existing ones with new ones from a file.
   *
   * This method first removes all existing common hooks for a project,
   * then registers new ones from the specified hooks file.
   *
   * @param projectId - The ID of the project to update hooks for
   * @param hooksFilePath - Path to the hooks.ts file to process
   * @returns Promise that resolves when hooks are updated
   * @throws Error when file operations or database operations fail
   *
   * @example
   * ```typescript
   * await commonHooksService.updateCommonHooks('project-123', '/path/to/hooks.ts');
   * ```
   */
  async updateCommonHooks(projectId: string, hooksFilePath: string): Promise<void> {
    this.logger.log(`Updating common hooks for project: ${projectId}`);

    try {
      // First remove existing common hooks
      await this.testStepRepository.delete({
        projectId,
        entityName: 'common',
      });

      // Then register the new ones
      await this.registerCommonHooksFromFile(projectId, hooksFilePath);
    } catch (error) {
      this.logger.error(`Error updating common hooks: ${error.message}`, error.stack);
      throw error;
    }
  }
} 