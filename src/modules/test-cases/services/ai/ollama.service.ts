import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { 
  OllamaRequest, 
  OllamaResponse, 
  TestCaseContext, 
  CodeValidationResult 
} from '../../interfaces/ollama.interface';

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  private readonly baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  private readonly defaultModel = process.env.OLLAMA_MODEL || 'codellama:latest';

  constructor() {}

  /**
   * Verifica si Ollama está disponible
   */
  async checkOllamaHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      this.logger.log('Ollama está disponible');
      return true;
    } catch (error) {
      this.logger.error('Ollama no está disponible:', error.message);
      return false;
    }
  }

  /**
   * Obtiene la lista de modelos disponibles
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      return response.data.models.map((model: any) => model.name);
    } catch (error) {
      this.logger.error('Error al obtener modelos:', error.message);
      return [];
    }
  }

  /**
   * Genera casos de prueba usando Ollama
   */
  async generateTestCases(context: TestCaseContext): Promise<string> {
    const prompt = this.buildPrompt(context);
    
    try {
      this.logger.log(`Generando casos de prueba para ${context.entityName}`);
      
      const request: OllamaRequest = {
        model: this.defaultModel,
        prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 2048,
        },
      };

      const response = await axios.post<OllamaResponse>(
        `${this.baseUrl}/api/generate`,
        request,
        {
          timeout: 30000, // 30 segundos timeout
        }
      );

      this.logger.log('Generación completada exitosamente');
      return this.parseResponse(response.data.response);
      
    } catch (error) {
      this.logger.error('Error al generar casos de prueba:', error.message);
      throw new Error(`Error en generación de IA: ${error.message}`);
    }
  }

  /**
   * Construye el prompt para la generación de casos de prueba
   */
  private buildPrompt(context: TestCaseContext): string {
    const { entityName, methods, analysis, existingPatterns } = context;
    
    return `
Eres un experto desarrollador TypeScript especializado en testing con Playwright + Cucumber.
Genera casos de prueba de alta calidad para la siguiente entidad:

**Entidad**: ${entityName}
**Métodos HTTP**: ${methods.join(', ')}
**Análisis del endpoint**: ${JSON.stringify(analysis, null, 2)}

${existingPatterns ? `**Patrones existentes**: ${JSON.stringify(existingPatterns, null, 2)}` : ''}

Genera el siguiente código en formato TypeScript:

1. **Feature File** (.feature) con escenarios BDD
2. **Step Definitions** (.ts) con implementación Playwright
3. **Fixtures** (.ts) con datos de prueba
4. **Schemas** (.ts) para validación

Sigue estas convenciones:
- Usa sintaxis Gherkin clara y descriptiva
- Implementa steps reutilizables
- Incluye validaciones robustas
- Usa datos de prueba realistas
- Sigue patrones de testing establecidos

Genera solo el código, sin explicaciones adicionales.
`;
  }

  /**
   * Parsea y limpia la respuesta de Ollama
   */
  private parseResponse(response: string): string {
    // Limpia la respuesta de Ollama
    let cleanedResponse = response.trim();
    
    // Remueve marcadores de código si existen
    if (cleanedResponse.includes('```typescript')) {
      cleanedResponse = cleanedResponse.replace(/```typescript\n?/g, '');
    }
    if (cleanedResponse.includes('```')) {
      cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
    }
    
    // Remueve explicaciones al inicio o final
    const lines = cleanedResponse.split('\n');
    const codeLines = lines.filter(line => 
      !line.startsWith('//') && 
      !line.startsWith('/*') && 
      !line.startsWith('Here') &&
      !line.startsWith('This') &&
      !line.startsWith('The')
    );
    
    return codeLines.join('\n').trim();
  }

  /**
   * Genera casos de prueba específicos para un método HTTP
   */
  async generateTestCasesForMethod(
    entityName: string,
    method: string,
    analysis: Record<string, any>
  ): Promise<string> {
    const context: TestCaseContext = {
      entityName,
      methods: [method],
      analysis,
    };

    return this.generateTestCases(context);
  }

  /**
   * Refina casos de prueba existentes
   */
  async refineExistingTestCases(
    existingCode: string,
    improvements: string[]
  ): Promise<string> {
    const prompt = `
Eres un experto desarrollador TypeScript. Refina el siguiente código de testing:

**Código existente:**
\`\`\`typescript
${existingCode}
\`\`\`

**Mejoras solicitadas:**
${improvements.map(imp => `- ${imp}`).join('\n')}

Genera el código refinado manteniendo la funcionalidad existente pero incorporando las mejoras solicitadas.
`;

    try {
      const request: OllamaRequest = {
        model: this.defaultModel,
        prompt,
        stream: false,
        options: {
          temperature: 0.5, // Menor temperatura para refinamiento
          top_p: 0.9,
          max_tokens: 2048,
        },
      };

      const response = await axios.post<OllamaResponse>(
        `${this.baseUrl}/api/generate`,
        request,
        { timeout: 30000 }
      );

      return this.parseResponse(response.data.response);
    } catch (error) {
      this.logger.error('Error al refinar casos de prueba:', error.message);
      throw new Error(`Error en refinamiento de IA: ${error.message}`);
    }
  }

  /**
   * Valida la calidad del código generado
   */
  async validateGeneratedCode(code: string): Promise<CodeValidationResult> {
    const prompt = `
Analiza la calidad del siguiente código TypeScript para testing:

\`\`\`typescript
${code}
\`\`\`

Evalúa:
1. Sintaxis correcta
2. Patrones de testing apropiados
3. Cobertura de casos de prueba
4. Reutilización de código
5. Validaciones robustas

Responde en formato JSON:
{
  "isValid": boolean,
  "issues": ["lista de problemas"],
  "suggestions": ["sugerencias de mejora"]
}
`;

    try {
      const request: OllamaRequest = {
        model: this.defaultModel,
        prompt,
        stream: false,
        options: {
          temperature: 0.3, // Baja temperatura para análisis
          top_p: 0.9,
          max_tokens: 1024,
        },
      };

      const response = await axios.post<OllamaResponse>(
        `${this.baseUrl}/api/generate`,
        request,
        { timeout: 15000 }
      );

      const validationText = response.data.response;
      
      // Intentar parsear JSON
      try {
        const validation = JSON.parse(validationText);
        return {
          isValid: validation.isValid || false,
          issues: validation.issues || [],
          suggestions: validation.suggestions || [],
        };
      } catch {
        // Si no es JSON válido, hacer análisis básico
        return {
          isValid: !validationText.includes('error') && !validationText.includes('invalid'),
          issues: validationText.includes('error') ? ['Error en el código'] : [],
          suggestions: validationText.includes('suggestion') ? ['Revisar código'] : [],
        };
      }
    } catch (error) {
      this.logger.error('Error al validar código:', error.message);
      return {
        isValid: false,
        issues: ['Error en validación de IA'],
        suggestions: ['Revisar manualmente el código generado'],
      };
    }
  }
} 