import { ExecuteTestsDto } from '../dto/execute-tests.dto';
import { BadRequestException } from '@nestjs/common';

export class ExecutionValidatorUtils {
  /**
   * Valida la configuración de ejecución
   */
  static validateExecutionConfig(dto: ExecuteTestsDto): void {
    // Validar entidad
    if (!dto.entityName || dto.entityName.trim() === '') {
      throw new BadRequestException('El nombre de la entidad es requerido');
    }

    // Validar timeout
    if (dto.timeout && (dto.timeout < 1000 || dto.timeout > 300000)) {
      throw new BadRequestException('El timeout debe estar entre 1000 y 300000 milisegundos');
    }

    // Validar retries
    if (dto.retries && (dto.retries < 0 || dto.retries > 5)) {
      throw new BadRequestException('El número de reintentos debe estar entre 0 y 5');
    }

    // Validar workers
    if (dto.workers && (dto.workers < 1 || dto.workers > 10)) {
      throw new BadRequestException('El número de workers debe estar entre 1 y 10');
    }

    // Validar tags
    if (dto.tags) {
      for (const tag of dto.tags) {
        if (!tag.startsWith('@')) {
          throw new BadRequestException(`Los tags deben comenzar con @: ${tag}`);
        }
      }
    }

    // Validar método
    if (dto.method) {
      const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
      if (!validMethods.includes(dto.method.toUpperCase())) {
        throw new BadRequestException(`Método HTTP inválido: ${dto.method}`);
      }
    }
  }

  /**
   * Valida que el proyecto tenga la estructura necesaria
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
          `El proyecto no tiene la estructura requerida. Falta: ${requiredPath}`
        );
      }
    }
  }

  /**
   * Valida que la entidad tenga casos de prueba
   */
  static async validateEntityHasTestCases(projectPath: string, entityName: string): Promise<void> {
    const fs = require('fs');
    const path = require('path');

    const featurePath = path.join(projectPath, 'src', 'features', 'ecommerce', `${entityName.toLowerCase()}.feature`);
    const stepsPath = path.join(projectPath, 'src', 'steps', 'ecommerce', `${entityName.toLowerCase()}.steps.ts`);

    if (!fs.existsSync(featurePath)) {
      throw new BadRequestException(
        `No se encontraron casos de prueba para la entidad '${entityName}'. Verifique que la entidad esté registrada.`
      );
    }

    if (!fs.existsSync(stepsPath)) {
      throw new BadRequestException(
        `No se encontraron definiciones de pasos para la entidad '${entityName}'. Verifique que la entidad esté registrada.`
      );
    }

    // Validar que el archivo feature tenga contenido
    const featureContent = fs.readFileSync(featurePath, 'utf8');
    if (!featureContent.includes('Scenario:')) {
      throw new BadRequestException(
        `El archivo de feature para '${entityName}' no contiene escenarios válidos.`
      );
    }
  }

  /**
   * Valida que los filtros especificados tengan casos de prueba disponibles
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
        `No se encontraron escenarios para la entidad '${entityName}'.`
      );
    }

    // Aplicar filtros para verificar que hay escenarios que coincidan
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
        `No se encontraron escenarios que coincidan con los filtros especificados. ${availableInfo}`
      );
    }
  }

  /**
   * Obtiene información sobre los escenarios disponibles para mostrar en el error
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

    return `Escenarios disponibles: ${scenarios.length} total. Métodos: ${Array.from(methods).join(', ')}. Tags: ${Array.from(tags).slice(0, 5).join(', ')}${tags.size > 5 ? '...' : ''}`;
  }

  /**
   * Valida la configuración de Playwright
   */
  static async validatePlaywrightConfig(projectPath: string): Promise<void> {
    const fs = require('fs');
    const path = require('path');

    const configPath = path.join(projectPath, 'playwright.config.ts');
    
    if (!fs.existsSync(configPath)) {
      throw new BadRequestException('No se encontró la configuración de Playwright');
    }

    // Validar que el archivo de configuración tenga el contenido mínimo necesario
    const configContent = fs.readFileSync(configPath, 'utf8');
    
    if (!configContent.includes('defineConfig')) {
      throw new BadRequestException('La configuración de Playwright no es válida');
    }
  }

  /**
   * Valida las dependencias del proyecto
   */
  static async validateProjectDependencies(projectPath: string): Promise<void> {
    const fs = require('fs');
    const path = require('path');

    const packagePath = path.join(projectPath, 'package.json');
    
    if (!fs.existsSync(packagePath)) {
      throw new BadRequestException('No se encontró el archivo package.json');
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
        `Faltan dependencias requeridas: ${missingDependencies.join(', ')}`
      );
    }
  }

  /**
   * Valida que el proyecto esté listo para ejecutar pruebas
   */
  static async validateProjectReady(projectPath: string): Promise<void> {
    await this.validateProjectStructure(projectPath);
    await this.validatePlaywrightConfig(projectPath);
    await this.validateProjectDependencies(projectPath);
  }

  /**
   * Obtiene información de validación para mostrar al usuario
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