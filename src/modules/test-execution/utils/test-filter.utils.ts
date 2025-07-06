import { ExecuteTestsDto } from '../dto/execute-tests.dto';

export interface TestFilter {
  entityName: string;
  method?: string;
  testType?: string;
  tags?: string[];
  specificScenario?: string;
}

export class TestFilterUtils {
  /**
   * Construye el filtro de Cucumber basado en los parámetros de ejecución
   */
  static buildCucumberFilter(dto: ExecuteTestsDto): string {
    const filters: string[] = [];

    // Filtro por entidad
    if (dto.entityName) {
      filters.push(`--require src/features/ecommerce/${dto.entityName.toLowerCase()}.feature`);
    }

    // Filtro por tags
    if (dto.tags && dto.tags.length > 0) {
      const tagFilters = dto.tags.map(tag => `--tags "${tag}"`).join(' ');
      filters.push(tagFilters);
    }

    // Filtro por escenario específico
    if (dto.specificScenario) {
      filters.push(`--name "${dto.specificScenario}"`);
    }

    // Filtro por tipo de prueba
    if (dto.testType && dto.testType !== 'all') {
      const testTypeTag = dto.testType === 'positive' ? '@positive' : '@negative';
      filters.push(`--tags "${testTypeTag}"`);
    }

    // Filtro por método HTTP
    if (dto.method) {
      const methodTag = `@${dto.method.toLowerCase()}`;
      filters.push(`--tags "${methodTag}"`);
    }

    return filters.join(' ');
  }

  /**
   * Valida si un escenario cumple con los filtros especificados
   */
  static validateScenarioAgainstFilters(
    scenario: any,
    filters: TestFilter,
  ): boolean {
    // Validar entidad
    if (filters.entityName && !scenario.feature?.name?.toLowerCase().includes(filters.entityName.toLowerCase())) {
      return false;
    }

    // Validar método HTTP
    if (filters.method) {
      const methodTag = `@${filters.method.toLowerCase()}`;
      const hasMethodTag = scenario.tags?.some((tag: any) => tag.name === methodTag);
      if (!hasMethodTag) {
        return false;
      }
    }

    // Validar tipo de prueba
    if (filters.testType && filters.testType !== 'all') {
      const testTypeTag = filters.testType === 'positive' ? '@positive' : '@negative';
      const hasTestTypeTag = scenario.tags?.some((tag: any) => tag.name === testTypeTag);
      if (!hasTestTypeTag) {
        return false;
      }
    }

    // Validar tags específicos
    if (filters.tags && filters.tags.length > 0) {
      const scenarioTags = scenario.tags?.map((tag: any) => tag.name) || [];
      const hasAllTags = filters.tags.every(tag => scenarioTags.includes(tag));
      if (!hasAllTags) {
        return false;
      }
    }

    // Validar escenario específico
    if (filters.specificScenario && scenario.name !== filters.specificScenario) {
      return false;
    }

    return true;
  }

  /**
   * Obtiene la lista de escenarios disponibles para una entidad
   */
  static async getAvailableScenarios(projectPath: string, entityName: string): Promise<any[]> {
    try {
      const fs = require('fs');
      const path = require('path');
      
      const featurePath = path.join(projectPath, 'src', 'features', 'ecommerce', `${entityName.toLowerCase()}.feature`);
      
      if (!fs.existsSync(featurePath)) {
        return [];
      }

      const featureContent = fs.readFileSync(featurePath, 'utf8');
      const scenarios = this.parseFeatureFile(featureContent);
      
      return scenarios;
    } catch (error) {
      console.error(`Error obteniendo escenarios para ${entityName}:`, error);
      return [];
    }
  }

  /**
   * Parsea un archivo .feature para extraer escenarios
   */
  private static parseFeatureFile(content: string): any[] {
    const scenarios: any[] = [];
    const lines = content.split('\n');
    
    let currentScenario: any = null;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('Scenario:')) {
        if (currentScenario) {
          scenarios.push(currentScenario);
        }
        
        currentScenario = {
          name: trimmedLine.replace('Scenario:', '').trim(),
          tags: [],
          steps: [],
        };
      } else if (trimmedLine.startsWith('@') && currentScenario) {
        currentScenario.tags.push(trimmedLine);
      } else if (trimmedLine.startsWith('Given ') || trimmedLine.startsWith('When ') || trimmedLine.startsWith('Then ') || trimmedLine.startsWith('And ')) {
        if (currentScenario) {
          currentScenario.steps.push(trimmedLine);
        }
      }
    }
    
    if (currentScenario) {
      scenarios.push(currentScenario);
    }
    
    return scenarios;
  }

  /**
   * Obtiene estadísticas de escenarios disponibles
   */
  static async getScenarioStatistics(projectPath: string, entityName: string): Promise<any> {
    const scenarios = await this.getAvailableScenarios(projectPath, entityName);
    
    const statistics = {
      totalScenarios: scenarios.length,
      positiveScenarios: 0,
      negativeScenarios: 0,
      scenariosByMethod: {} as Record<string, number>,
      scenariosByTag: {} as Record<string, number>,
    };

    for (const scenario of scenarios) {
      // Contar por tipo
      if (scenario.tags.some((tag: string) => tag.includes('@positive'))) {
        statistics.positiveScenarios++;
      }
      if (scenario.tags.some((tag: string) => tag.includes('@negative'))) {
        statistics.negativeScenarios++;
      }

      // Contar por método
      for (const tag of scenario.tags) {
        if (tag.includes('@get') || tag.includes('@post') || tag.includes('@put') || tag.includes('@patch') || tag.includes('@delete')) {
          const method = tag.replace('@', '');
          statistics.scenariosByMethod[method] = (statistics.scenariosByMethod[method] || 0) + 1;
        }
      }

      // Contar por tags
      for (const tag of scenario.tags) {
        statistics.scenariosByTag[tag] = (statistics.scenariosByTag[tag] || 0) + 1;
      }
    }

    return statistics;
  }
} 