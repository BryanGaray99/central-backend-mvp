import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { 
  AIGenerationRequest, 
  AIGenerationResponse, 
  GeneratedCode, 
  CodeInsertion,
  ProjectContext 
} from '../interfaces/ai-agent.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../../projects/project.entity';
import { 
  StepFilesManipulationService,
  FeatureFilesManipulationService,
  CodeInsertionService,
  CodeParsingService,
  TestCaseAnalysisService
} from '../../../common/services/code-manipulation';

@Injectable()
export class AIAgentService {
  private readonly logger = new Logger(AIAgentService.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly stepFilesManipulationService: StepFilesManipulationService,
    private readonly featureFilesManipulationService: FeatureFilesManipulationService,
    private readonly codeInsertionService: CodeInsertionService,
    private readonly codeParsingService: CodeParsingService,
    private readonly testCaseAnalysisService: TestCaseAnalysisService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  /**
   * Genera casos de prueba usando IA
   */
  async generateTestCases(request: AIGenerationRequest): Promise<AIGenerationResponse> {
    const startTime = Date.now();
    const generationId = `AI-GEN-${Date.now()}`;
    
    this.logger.log(`🚀 [${generationId}] INICIANDO GENERACIÓN DE TESTS`);
    this.logger.log(`📋 [${generationId}] Request: ${JSON.stringify(request, null, 2)}`);
    
    try {
      // Obtener el proyecto para usar su path
      const project = await this.projectRepository.findOneBy({ id: request.projectId });
      if (!project) {
        throw new Error(`Project with ID ${request.projectId} not found`);
      }
      
      // Crear directorio de debug en la raíz de playwright-workspaces
      const debugDir = path.join(path.dirname(project.path), 'debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }

      // Paso 1: Generar código nuevo
      this.logger.log(`🔧 [${generationId}] PASO 1: Generando código nuevo...`);
      const newCode = await this.generateNewCode(request, generationId);
      this.logger.log(`✅ [${generationId}] Código generado: ${JSON.stringify(newCode, null, 2)}`);
      
      // Paso 2: Analizar archivos existentes y determinar inserción
      this.logger.log(`🔍 [${generationId}] PASO 2: Analizando archivos existentes...`);
      const insertions = await this.testCaseAnalysisService.analyzeAndDetermineInsertions(request, newCode, generationId);
      this.logger.log(`✅ [${generationId}] Inserciones determinadas: ${JSON.stringify(insertions, null, 2)}`);
      
      // Paso 3: Insertar código en archivos
      this.logger.log(`📝 [${generationId}] PASO 3: Insertando código en archivos...`);
      const insertionResult = await this.codeInsertionService.insertCode(insertions, generationId);
      this.logger.log(`✅ [${generationId}] Resultado de inserción: ${JSON.stringify(insertionResult, null, 2)}`);

      const processingTime = Date.now() - startTime;

      this.logger.log(`🎉 [${generationId}] GENERACIÓN COMPLETADA en ${processingTime}ms`);

      // Guardar resumen final
      const summary = {
        generationId,
        request,
        newCode,
        insertions,
        insertionResult,
        processingTime,
        success: true,
        timestamp: new Date().toISOString(),
      };
      
      const summaryPath = path.join(debugDir, `${generationId}-summary.json`);
      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
      this.logger.log(`📄 [${generationId}] Resumen guardado en: ${summaryPath}`);

      return {
        success: true,
        data: {
          newCode,
          insertions,
        },
        metadata: {
          processingTime,
          tokensUsed: 0,
          modelUsed: 'gpt-4o-mini',
          generationId,
        },
      };

    } catch (error) {
      this.logger.error(`❌ [${generationId}] ERROR en generación de tests: ${error.message}`);
      
      // Guardar error
      const errorLog = {
        generationId,
        request,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      };
      
      // Obtener el proyecto para usar su path
      const project = await this.projectRepository.findOneBy({ id: request.projectId });
      if (project) {
        const debugDir = path.join(path.dirname(project.path), 'debug');
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }
        
        const errorPath = path.join(debugDir, `${generationId}-error.json`);
        fs.writeFileSync(errorPath, JSON.stringify(errorLog, null, 2));
        this.logger.log(`📄 [${generationId}] Error guardado en: ${errorPath}`);
      }
      
      return {
        success: false,
        error: error.message,
        metadata: {
          processingTime: Date.now() - startTime,
          tokensUsed: 0,
          modelUsed: 'gpt-4o-mini',
          generationId,
        },
      };
    }
  }

  /**
   * Paso 1: Generar código nuevo
   */
  private async generateNewCode(request: AIGenerationRequest, generationId: string): Promise<GeneratedCode> {
    this.logger.log(`🤖 [${generationId}] Construyendo prompt para OpenAI...`);
    
    let prompt: string;
    try {
      prompt = await this.buildGenerationPrompt(request, generationId);
      this.logger.log(`✅ [${generationId}] Prompt construido exitosamente`);
      this.logger.log(`📤 [${generationId}] Prompt construido:`);
      this.logger.log(prompt);
    } catch (error: any) {
      this.logger.error(`❌ [${generationId}] Error construyendo prompt: ${error.message}`);
      this.logger.error(`❌ [${generationId}] Stack trace: ${error.stack}`);
      
      // Fallback al prompt simple
      prompt = `Genera tests completos de APIs REST con Playwright y BDD para una entidad llamada "${request.entityName}" del tipo "${request.section}".\n\n`;
      prompt += `OPERACIÓN: ${request.operation}\n`;
      prompt += `REQUISITOS: ${request.requirements}\n\n`;
      prompt += `IMPORTANTE: SOLO testing de APIs REST, NO testing de UI web. NO incluyas "Feature:" ni rutas de archivos.`;
      
      this.logger.log(`⚠️ [${generationId}] Usando prompt fallback`);
      this.logger.log(`📤 [${generationId}] Prompt fallback:`);
      this.logger.log(prompt);
    }
    
    // Obtener el proyecto para usar su path
    const project = await this.projectRepository.findOneBy({ id: request.projectId });
    if (!project) {
      throw new Error(`Project with ID ${request.projectId} not found`);
    }
    
    // Guardar prompt enviado
    const debugDir = path.join(path.dirname(project.path), 'debug');
    const promptPath = path.join(debugDir, `${generationId}-prompt.txt`);
    fs.writeFileSync(promptPath, prompt);
    this.logger.log(`📄 [${generationId}] Prompt guardado en: ${promptPath}`);
    
    this.logger.log(`🌐 [${generationId}] Enviando request a OpenAI...`);
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Eres un agente especializado en generación de casos de prueba para APIs REST con Playwright, TypeScript y BDD.

OBJETIVO: Generar código funcional y listo para usar para testing de APIs, NO testing de UI web.

CAPACIDADES:
- Generar código completo de tests de APIs REST con Playwright
- Crear escenarios Gherkin específicos para APIs
- Implementar steps de Cucumber para llamadas HTTP
- Seguir patrones y convenciones existentes
- Reutilizar steps existentes cuando sea posible

ESTRUCTURA DE ARCHIVOS QUE GENERAS:
- features/[entity].feature - Escenarios BDD en Gherkin (SOLO escenarios, NO incluir "Feature:" ni "# features/...")
- steps/[entity].steps.ts - Implementación de steps de Cucumber para APIs

PATRONES QUE SIGUES:
- Given-When-Then para estructura BDD
- Tests positivos y negativos para APIs
- Convenciones de nomenclatura consistentes
- Manejo apropiado de errores HTTP
- Uso de clientes API existentes (no crear nuevos)
- Reutilización de steps existentes

IMPORTANTE:
- SOLO testing de APIs REST, NO testing de UI web
- NO incluir "Feature:" ni rutas de archivos en el código
- Reutilizar steps existentes cuando sea posible
- Solo crear nuevos steps si no existen
- Usar clientes API existentes del proyecto

RESPUESTA:
- Genera solo el código necesario
- Incluye solo lo necesario (evita duplicación)
- Código listo para copiar y pegar
- Sin explicaciones innecesarias
- Solo código y estructura de archivos`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const generatedText = response.choices[0]?.message?.content || '';
    
    this.logger.log(`📥 [${generationId}] Respuesta recibida de OpenAI:`);
    this.logger.log(generatedText);
    
    // Guardar respuesta bruta
    const responsePath = path.join(debugDir, `${generationId}-response.txt`);
    fs.writeFileSync(responsePath, generatedText);
    this.logger.log(`📄 [${generationId}] Respuesta guardada en: ${responsePath}`);
    
    // Guardar metadata de la respuesta
    const responseMetadata = {
      generationId,
      model: response.model,
      usage: response.usage,
      finishReason: response.choices[0]?.finish_reason,
      timestamp: new Date().toISOString(),
    };
    
    const metadataPath = path.join(debugDir, `${generationId}-metadata.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(responseMetadata, null, 2));
    this.logger.log(`📄 [${generationId}] Metadata guardada en: ${metadataPath}`);
    
    // Parsear la respuesta para extraer código
    this.logger.log(`🔍 [${generationId}] Parseando respuesta...`);
    const parsedCode = this.codeParsingService.parseGeneratedCode(generatedText);
    this.logger.log(`✅ [${generationId}] Código parseado: ${JSON.stringify(parsedCode, null, 2)}`);
    
    return parsedCode;
  }

  /**
   * Construye el prompt para generación de código con contexto completo
   */
  private async buildGenerationPrompt(request: AIGenerationRequest, generationId: string): Promise<string> {
    this.logger.log(`🔍 [${generationId}] Construyendo prompt con contexto completo...`);
    
    // Obtener el proyecto para acceder a los archivos
    const project = await this.projectRepository.findOneBy({ id: request.projectId });
    if (!project) {
      throw new Error(`Project with ID ${request.projectId} not found`);
    }
    
    let prompt = `Genera tests completos de APIs REST con Playwright y BDD para una entidad llamada "${request.entityName}" del tipo "${request.section}".\n\n`;
    
    prompt += `OPERACIÓN: ${request.operation}\n`;
    prompt += `REQUISITOS: ${request.requirements}\n\n`;
    
    // Incluir contexto del archivo feature existente
    const featurePath = path.join(project.path, `src/features/${request.section}/${request.entityName.toLowerCase()}.feature`);
    if (fs.existsSync(featurePath)) {
      const featureContent = fs.readFileSync(featurePath, 'utf-8');
      prompt += `=== ARCHIVO FEATURE EXISTENTE ===\n`;
      prompt += `${featureContent}\n\n`;
      this.logger.log(`📄 [${generationId}] Contexto de feature incluido (${featureContent.length} caracteres)`);
    } else {
      prompt += `=== ARCHIVO FEATURE NO EXISTE ===\n`;
      this.logger.log(`⚠️ [${generationId}] Archivo feature no existe: ${featurePath}`);
    }
    
    // Incluir contexto del archivo steps existente
    const stepsPath = path.join(project.path, `src/steps/${request.section}/${request.entityName.toLowerCase()}.steps.ts`);
    if (fs.existsSync(stepsPath)) {
      const stepsContent = fs.readFileSync(stepsPath, 'utf-8');
      prompt += `=== ARCHIVO STEPS EXISTENTE ===\n`;
      prompt += `${stepsContent}\n\n`;
      this.logger.log(`📄 [${generationId}] Contexto de steps incluido (${stepsContent.length} caracteres)`);
    } else {
      prompt += `=== ARCHIVO STEPS NO EXISTE ===\n`;
      this.logger.log(`⚠️ [${generationId}] Archivo steps no existe: ${stepsPath}`);
    }
    
    prompt += `=== INSTRUCCIONES ===\n`;
    prompt += `1. SOLO testing de APIs REST, NO testing de UI web\n`;
    prompt += `2. Reutiliza steps existentes cuando sea posible\n`;
    prompt += `3. Solo crea nuevos steps si no existen\n`;
    prompt += `4. NO incluyas "Feature:" ni rutas de archivos en el código generado\n`;
    prompt += `5. Usa clientes API existentes del proyecto\n`;
    prompt += `6. Genera solo escenarios y steps nuevos, sin duplicar\n`;
    prompt += `7. Mantén el estilo y convenciones existentes\n`;
    prompt += `8. NO incluyas imports a menos que no existan en el archivo\n`;
    prompt += `9. Para steps, usa los comentarios de sección como referencia:\n`;
    prompt += `   - Given steps: antes de "// When steps"\n`;
    prompt += `   - When steps: antes de "// Then steps"\n`;
    prompt += `   - Then steps: al final del archivo\n\n`;
    
    prompt += `Genera solo el código necesario, sin explicaciones. Incluye escenarios Gherkin y steps de Cucumber correspondientes.`;

    this.logger.log(`📝 [${generationId}] Prompt construido (${prompt.length} caracteres)`);
    
    return prompt;
  }

} 