import { Injectable, Logger } from '@nestjs/common';
import { OllamaService } from './ollama.service';
import { TSMorphService } from '../code-manipulation/ts-morph.service';
import { TestCaseContext } from '../../interfaces/ollama.interface';
import { CodeAnalysis } from '../../interfaces/ts-morph.interface';
import { 
  AIGenerationResult, 
  AIGenerationOptions, 
  AIHealthStatus, 
  GenerationStats 
} from '../../interfaces/ai-test-generator.interface';

@Injectable()
export class AITestGeneratorService {
  private readonly logger = new Logger(AITestGeneratorService.name);

  constructor(
    private readonly ollamaService: OllamaService,
    private readonly tsMorphService: TSMorphService,
  ) {}

  /**
   * Genera casos de prueba inteligentes con IA
   */
  async generateIntelligentTests(options: AIGenerationOptions): Promise<AIGenerationResult> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Iniciando generación de tests para: ${options.entityName}`);

      // 1. Verificar que Ollama esté disponible
      const ollamaAvailable = await this.ollamaService.checkOllamaHealth();
      if (!ollamaAvailable) {
        throw new Error('Ollama no está disponible. Verifica que el servicio esté ejecutándose.');
      }

      // 2. Analizar código existente del proyecto
      let codeAnalysis: CodeAnalysis;
      if (options.projectPath) {
        codeAnalysis = await this.tsMorphService.analyzeProject(options.projectPath);
        this.logger.log(`Análisis completado: ${codeAnalysis.patterns.length} patrones encontrados`);
      } else {
        codeAnalysis = {
          existingTests: [],
          imports: [],
          patterns: [],
          classes: [],
          interfaces: [],
          methods: [],
        };
      }

      // 3. Construir contexto para IA
      const context: TestCaseContext = {
        entityName: options.entityName,
        methods: options.methods,
        analysis: options.analysis,
        projectPath: options.projectPath,
        existingPatterns: codeAnalysis.patterns,
      };

      // 4. Generar código con IA
      this.logger.log('Generando código con IA...');
      const generatedCode = await this.ollamaService.generateTestCases(context);

      // 5. Validar y refinar con TS-Morph
      this.logger.log('Validando y refinando código...');
      const refinedCode = await this.tsMorphService.validateAndRefine(generatedCode, codeAnalysis);

      // 6. Validar calidad del código final
      const validation = await this.ollamaService.validateGeneratedCode(refinedCode);

      const generationTime = Date.now() - startTime;

      const result: AIGenerationResult = {
        success: true,
        generatedCode: refinedCode,
        validation,
        analysis: codeAnalysis,
        metadata: {
          entityName: options.entityName,
          methods: options.methods,
          generationTime,
          modelUsed: await this.getModelUsed(),
        },
      };

      this.logger.log(`Generación completada en ${generationTime}ms`);
      return result;

    } catch (error) {
      this.logger.error('Error en generación de tests:', error.message);
      
      return {
        success: false,
        generatedCode: '',
        validation: {
          isValid: false,
          issues: [error.message],
          suggestions: ['Verificar configuración de Ollama', 'Revisar logs del sistema'],
        },
        analysis: {
          existingTests: [],
          imports: [],
          patterns: [],
          classes: [],
          interfaces: [],
          methods: [],
        },
        metadata: {
          entityName: options.entityName,
          methods: options.methods,
          generationTime: Date.now() - startTime,
          modelUsed: 'unknown',
        },
      };
    }
  }

  /**
   * Genera tests específicos para un método HTTP
   */
  async generateTestsForMethod(
    entityName: string,
    method: string,
    analysis: Record<string, any>,
    projectPath?: string
  ): Promise<AIGenerationResult> {
    return this.generateIntelligentTests({
      entityName,
      methods: [method],
      analysis,
      projectPath,
    });
  }

  /**
   * Refina tests existentes con IA
   */
  async refineExistingTests(
    existingCode: string,
    improvements: string[],
    projectPath?: string
  ): Promise<AIGenerationResult> {
    const startTime = Date.now();

    try {
      this.logger.log('Refinando tests existentes...');

      // 1. Analizar código existente
      let codeAnalysis: CodeAnalysis;
      if (projectPath) {
        codeAnalysis = await this.tsMorphService.analyzeProject(projectPath);
      } else {
        codeAnalysis = {
          existingTests: [],
          imports: [],
          patterns: [],
          classes: [],
          interfaces: [],
          methods: [],
        };
      }

      // 2. Refinar con IA
      const refinedCode = await this.ollamaService.refineExistingTestCases(existingCode, improvements);

      // 3. Validar y refinar con TS-Morph
      const finalCode = await this.tsMorphService.validateAndRefine(refinedCode, codeAnalysis);

      // 4. Validar calidad
      const validation = await this.ollamaService.validateGeneratedCode(finalCode);

      const generationTime = Date.now() - startTime;

      return {
        success: true,
        generatedCode: finalCode,
        validation,
        analysis: codeAnalysis,
        metadata: {
          entityName: 'refined',
          methods: [],
          generationTime,
          modelUsed: await this.getModelUsed(),
        },
      };

    } catch (error) {
      this.logger.error('Error al refinar tests:', error.message);
      
      return {
        success: false,
        generatedCode: existingCode, // Mantener código original
        validation: {
          isValid: false,
          issues: [error.message],
          suggestions: ['Revisar código manualmente'],
        },
        analysis: {
          existingTests: [],
          imports: [],
          patterns: [],
          classes: [],
          interfaces: [],
          methods: [],
        },
        metadata: {
          entityName: 'refined',
          methods: [],
          generationTime: Date.now() - startTime,
          modelUsed: 'unknown',
        },
      };
    }
  }

  /**
   * Genera fixtures de datos de prueba
   */
  async generateTestFixtures(
    entityName: string,
    analysis: Record<string, any>
  ): Promise<string> {
    try {
      const prompt = `
Genera fixtures de datos de prueba para la entidad: ${entityName}

Análisis: ${JSON.stringify(analysis, null, 2)}

Genera:
1. Datos válidos para testing positivo
2. Datos inválidos para testing negativo
3. Datos edge cases
4. Datos para diferentes escenarios

Usa @faker-js/faker para generar datos realistas.
`;

      const context: TestCaseContext = {
        entityName,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        analysis,
      };

      return await this.ollamaService.generateTestCases(context);
    } catch (error) {
      this.logger.error('Error al generar fixtures:', error.message);
      throw error;
    }
  }

  /**
   * Genera schemas de validación
   */
  async generateValidationSchemas(
    entityName: string,
    analysis: Record<string, any>
  ): Promise<string> {
    try {
      const prompt = `
Genera schemas de validación para la entidad: ${entityName}

Análisis: ${JSON.stringify(analysis, null, 2)}

Genera:
1. Schema para creación (POST)
2. Schema para actualización (PUT/PATCH)
3. Schema para respuesta (GET)
4. Validaciones de campos
5. Tipos TypeScript

Usa Ajv para validaciones.
`;

      const context: TestCaseContext = {
        entityName,
        methods: ['GET', 'POST', 'PUT', 'PATCH'],
        analysis,
      };

      return await this.ollamaService.generateTestCases(context);
    } catch (error) {
      this.logger.error('Error al generar schemas:', error.message);
      throw error;
    }
  }

  /**
   * Obtiene el modelo usado actualmente
   */
  private async getModelUsed(): Promise<string> {
    try {
      const models = await this.ollamaService.getAvailableModels();
      return models.length > 0 ? models[0] : 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Verifica el estado del sistema de IA
   */
  async checkAIHealth(): Promise<AIHealthStatus> {
    const ollamaAvailable = await this.ollamaService.checkOllamaHealth();
    const modelsAvailable = ollamaAvailable ? await this.ollamaService.getAvailableModels() : [];
    const tsMorphAvailable = true; // TS-Morph siempre está disponible

    return {
      ollamaAvailable,
      modelsAvailable,
      tsMorphAvailable,
    };
  }

  /**
   * Obtiene estadísticas de generación
   */
  async getGenerationStats(): Promise<GenerationStats> {
    // TODO: Implementar tracking de estadísticas
    return {
      totalGenerations: 0,
      successRate: 0,
      averageGenerationTime: 0,
      mostUsedEntities: [],
    };
  }
} 