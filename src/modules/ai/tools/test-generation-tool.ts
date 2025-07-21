import { AITool, GeneratedCode } from '../interfaces/ai-agent.interface';

export const testGenerationTool: AITool = {
  name: 'testGenerationTool',
  description: 'Genera código completo de tests de Playwright con BDD para una entidad específica',
  
  async execute(params: {
    entityName: string;
    section: string;
    requirements: string;
    context?: any;
  }): Promise<GeneratedCode> {
    const { entityName, section, requirements, context } = params;
    
    // Esta herramienta será llamada por el agente de IA
    // El agente generará el código usando OpenAI
    // Aquí solo definimos la estructura de respuesta
    
    return {
      feature: `# Feature file content for ${entityName}`,
      steps: `# Steps file content for ${entityName}`,
      tests: `# Test file content for ${entityName}`,
      fixtures: `# Fixture file content for ${entityName}`,
      schemas: `# Schema file content for ${entityName}`,
      types: `# Types file content for ${entityName}`,
      client: `# Client file content for ${entityName}`,
    };
  },
}; 