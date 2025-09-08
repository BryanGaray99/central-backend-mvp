import { ExecuteTestsDto } from '../dto/execute-tests.dto';

/**
 * Criteria used to filter available scenarios.
 */
export interface TestFilter {
  entityName: string;
  method?: string;
  testType?: string;
  tags?: string[];
  specificScenario?: string;
}

/**
 * Helper utilities to build cucumber filters and validate scenarios.
 */
export class TestFilterUtils {
  /**
   * Builds Cucumber filter string based on the execution parameters.
   */
  static buildCucumberFilter(dto: ExecuteTestsDto): string {
    const filters: string[] = [];

    // Filter by entity
    if (dto.entityName) {
      filters.push(`--require src/features/ecommerce/${dto.entityName.toLowerCase()}.feature`);
    }

    // Filter by tags
    if (dto.tags && dto.tags.length > 0) {
      const tagFilters = dto.tags.map(tag => `--tags "${tag}"`).join(' ');
      filters.push(tagFilters);
    }

    // Filter by specific scenario
    if (dto.specificScenario) {
      filters.push(`--name "${dto.specificScenario}"`);
    }

    // Filter by test type
    if (dto.testType && dto.testType !== 'all') {
      const testTypeTag = dto.testType === 'positive' ? '@positive' : '@negative';
      filters.push(`--tags "${testTypeTag}"`);
    }

    // Filter by HTTP method
    if (dto.method) {
      const methodTag = `@${dto.method.toLowerCase()}`;
      filters.push(`--tags "${methodTag}"`);
    }

    return filters.join(' ');
  }

  /**
   * Validates if a scenario meets the specified filters.
   */
  static validateScenarioAgainstFilters(
    scenario: any,
    filters: TestFilter,
  ): boolean {
    // Validate entity
    if (filters.entityName && !scenario.feature?.name?.toLowerCase().includes(filters.entityName.toLowerCase())) {
      return false;
    }

    // Validate HTTP method
    if (filters.method) {
      const methodTag = `@${filters.method.toLowerCase()}`;
      const hasMethodTag = scenario.tags?.some((tag: any) => tag.name === methodTag);
      if (!hasMethodTag) {
        return false;
      }
    }

    // Validate test type
    if (filters.testType && filters.testType !== 'all') {
      const testTypeTag = filters.testType === 'positive' ? '@positive' : '@negative';
      const hasTestTypeTag = scenario.tags?.some((tag: any) => tag.name === testTypeTag);
      if (!hasTestTypeTag) {
        return false;
      }
    }

    // Validate specific tags
    if (filters.tags && filters.tags.length > 0) {
      const scenarioTags = scenario.tags?.map((tag: any) => tag.name) || [];
      const hasAllTags = filters.tags.every(tag => scenarioTags.includes(tag));
      if (!hasAllTags) {
        return false;
      }
    }

    // Validate specific scenario
    if (filters.specificScenario && scenario.name !== filters.specificScenario) {
      return false;
    }

    return true;
  }

  /**
   * Gets the list of scenarios available for an entity.
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
      console.error(`Error getting scenarios for ${entityName}:`, error);
      return [];
    }
  }

  /**
   * Parses a .feature file to extract scenarios.
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
   * Computes statistics for available scenarios.
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
      // Count by type
      if (scenario.tags.some((tag: string) => tag.includes('@positive'))) {
        statistics.positiveScenarios++;
      }
      if (scenario.tags.some((tag: string) => tag.includes('@negative'))) {
        statistics.negativeScenarios++;
      }

      // Count by method
      for (const tag of scenario.tags) {
        if (tag.includes('@get') || tag.includes('@post') || tag.includes('@put') || tag.includes('@patch') || tag.includes('@delete')) {
          const method = tag.replace('@', '');
          statistics.scenariosByMethod[method] = (statistics.scenariosByMethod[method] || 0) + 1;
        }
      }

      // Count by tags
      for (const tag of scenario.tags) {
        statistics.scenariosByTag[tag] = (statistics.scenariosByTag[tag] || 0) + 1;
      }
    }

    return statistics;
  }
} 