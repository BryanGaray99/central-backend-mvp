import { ExecuteTestsDto } from '../dto/execute-tests.dto';
import { BadRequestException } from '@nestjs/common';

/**
 * Utility helpers to validate execution inputs and project readiness.
 */
export class ExecutionValidatorUtils {
  /**
   * Validates execution configuration DTO.
   */
  static validateExecutionConfig(dto: ExecuteTestsDto): void {
    // Validate entity
    if (!dto.entityName || dto.entityName.trim() === '') {
      throw new BadRequestException('Entity name is required');
    }

    // Validate timeout
    if (dto.timeout && (dto.timeout < 1000 || dto.timeout > 300000)) {
      throw new BadRequestException('Timeout must be between 1000 and 300000 milliseconds');
    }

    // Validate retries
    if (dto.retries && (dto.retries < 0 || dto.retries > 5)) {
      throw new BadRequestException('Retries must be between 0 and 5');
    }

    // Validate workers
    if (dto.workers && (dto.workers < 1 || dto.workers > 10)) {
      throw new BadRequestException('Workers must be between 1 and 10');
    }

    // Validate tags
    if (dto.tags) {
      for (const tag of dto.tags) {
        if (!tag.startsWith('@')) {
          throw new BadRequestException(`Tags must start with @: ${tag}`);
        }
      }
    }

    // Validate method
    if (dto.method) {
      const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
      if (!validMethods.includes(dto.method.toUpperCase())) {
        throw new BadRequestException(`Invalid HTTP method: ${dto.method}`);
      }
    }
  }

  /**
   * Validates that the project has the required structure.
   */
  static async validateProjectStructure(projectPath: string): Promise<void> {
    const fs = require('fs');
    const path = require('path');

    const requiredPaths = [
      'src/features',
      'src/steps',
      'src/fixtures',
      'src/schemas',
      'src/types',
      'src/api',
      'cucumber.cjs',
      'playwright.config.ts',
      'package.json',
    ];

    for (const requiredPath of requiredPaths) {
      const fullPath = path.join(projectPath, requiredPath);
      if (!fs.existsSync(fullPath)) {
        throw new BadRequestException(
          `Project is missing required structure. Missing: ${requiredPath}`
        );
      }
    }
  }

  /**
   * Validates that the entity has test cases.
   */
  static async validateEntityHasTestCases(projectPath: string, entityName: string): Promise<void> {
    const fs = require('fs');
    const path = require('path');

    const featurePath = path.join(projectPath, 'src', 'features', 'ecommerce', `${entityName.toLowerCase()}.feature`);
    const stepsPath = path.join(projectPath, 'src', 'steps', 'ecommerce', `${entityName.toLowerCase()}.steps.ts`);

    if (!fs.existsSync(featurePath)) {
      throw new BadRequestException(
        `No test cases found for entity '${entityName}'. Ensure the entity is registered.`
      );
    }

    if (!fs.existsSync(stepsPath)) {
      throw new BadRequestException(
        `No step definitions found for entity '${entityName}'. Ensure the entity is registered.`
      );
    }

    // Validate that the feature file has content
    const featureContent = fs.readFileSync(featurePath, 'utf8');
    if (!featureContent.includes('Scenario:')) {
      throw new BadRequestException(
        `The feature file for '${entityName}' does not contain valid scenarios.`
      );
    }
  }

  /**
   * Validates that the specified filters match available test cases.
   */
  static async validateFiltersHaveTestCases(
    projectPath: string,
    entityName: string,
    dto: ExecuteTestsDto,
  ): Promise<void> {
    const { TestFilterUtils } = require('./test-filter.utils');
    
    const availableScenarios = await TestFilterUtils.getAvailableScenarios(projectPath, entityName);
    
    if (availableScenarios.length === 0) {
      throw new BadRequestException(
        `No scenarios found for entity '${entityName}'.`
      );
    }

    // Apply filters to verify there are matching scenarios
    const filteredScenarios = availableScenarios.filter(scenario => {
      const filters = {
        entityName: dto.entityName,
        method: dto.method,
        testType: dto.testType,
        tags: dto.tags,
        specificScenario: dto.specificScenario,
      };
      
      return TestFilterUtils.validateScenarioAgainstFilters(scenario, filters);
    });

    if (filteredScenarios.length === 0) {
      const availableInfo = this.getAvailableScenariosInfo(availableScenarios);
      throw new BadRequestException(
        `No scenarios match the specified filters. ${availableInfo}`
      );
    }
  }

  /**
   * Builds a summary of available scenarios to include in error messages.
   */
  private static getAvailableScenariosInfo(scenarios: any[]): string {
    const methods = new Set<string>();
    const tags = new Set<string>();

    for (const scenario of scenarios) {
      for (const tag of scenario.tags) {
        if (tag.includes('@get') || tag.includes('@post') || tag.includes('@put') || tag.includes('@patch') || tag.includes('@delete')) {
          methods.add(tag.replace('@', ''));
        }
        tags.add(tag);
      }
    }

    return `Available scenarios: ${scenarios.length} total. Methods: ${Array.from(methods).join(', ')}. Tags: ${Array.from(tags).slice(0, 5).join(', ')}${tags.size > 5 ? '...' : ''}`;
  }

  /**
   * Validates Playwright configuration file presence and basic structure.
   */
  static async validatePlaywrightConfig(projectPath: string): Promise<void> {
    const fs = require('fs');
    const path = require('path');

    const configPath = path.join(projectPath, 'playwright.config.ts');
    
    if (!fs.existsSync(configPath)) {
      throw new BadRequestException('Playwright configuration not found');
    }

    // Validate that the configuration file has the minimal required content
    const configContent = fs.readFileSync(configPath, 'utf8');
    
    if (!configContent.includes('defineConfig')) {
      throw new BadRequestException('Invalid Playwright configuration');
    }
  }

  /**
   * Validates project dependencies for test execution.
   */
  static async validateProjectDependencies(projectPath: string): Promise<void> {
    const fs = require('fs');
    const path = require('path');

    const packagePath = path.join(projectPath, 'package.json');
    
    if (!fs.existsSync(packagePath)) {
      throw new BadRequestException('package.json not found');
    }

    const packageContent = fs.readFileSync(packagePath, 'utf8');
    const packageJson = JSON.parse(packageContent);

    const requiredDependencies = [
      '@playwright/test',
      '@cucumber/cucumber',
      'playwright',
    ];

    const missingDependencies = requiredDependencies.filter(dep => {
      return !packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep];
    });

    if (missingDependencies.length > 0) {
      throw new BadRequestException(
        `Missing required dependencies: ${missingDependencies.join(', ')}`
      );
    }
  }

  /**
   * Validates that the project is ready to run tests.
   */
  static async validateProjectReady(projectPath: string): Promise<void> {
    await this.validateProjectStructure(projectPath);
    await this.validatePlaywrightConfig(projectPath);
    await this.validateProjectDependencies(projectPath);
  }

  /**
   * Builds validation info about available scenarios and statistics.
   */
  static async getValidationInfo(projectPath: string, entityName: string): Promise<any> {
    const { TestFilterUtils } = require('./test-filter.utils');
    
    try {
      const scenarios = await TestFilterUtils.getAvailableScenarios(projectPath, entityName);
      const statistics = await TestFilterUtils.getScenarioStatistics(projectPath, entityName);
      
      return {
        entityName,
        totalScenarios: scenarios.length,
        statistics,
        scenarios: scenarios.slice(0, 5).map((s: any) => ({
          name: s.name,
          tags: s.tags,
          stepsCount: s.steps.length,
        })),
        hasMoreScenarios: scenarios.length > 5,
      };
    } catch (error) {
      return {
        entityName,
        error: error.message,
        totalScenarios: 0,
      };
    }
  }
} 