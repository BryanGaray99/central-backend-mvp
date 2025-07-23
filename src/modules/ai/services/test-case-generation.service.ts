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
import { Endpoint } from '../../endpoints/endpoint.entity';
import { 
  StepFilesManipulationService,
  FeatureFilesManipulationService,
  CodeInsertionService,
  CodeParsingService,
  TestCaseAnalysisService
} from '../../../common/services/code-manipulation';
import { AssistantManagerService } from './assistant-manager.service';
import { ThreadManagerService } from './thread-manager.service';

@Injectable()
export class TestCaseGenerationService {
  private readonly logger = new Logger(TestCaseGenerationService.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Endpoint)
    private readonly endpointRepository: Repository<Endpoint>,
    private readonly stepFilesManipulationService: StepFilesManipulationService,
    private readonly featureFilesManipulationService: FeatureFilesManipulationService,
    private readonly codeInsertionService: CodeInsertionService,
    private readonly codeParsingService: CodeParsingService,
    private readonly testCaseAnalysisService: TestCaseAnalysisService,
    private readonly assistantManagerService: AssistantManagerService,
    private readonly threadManagerService: ThreadManagerService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  /**
   * Genera casos de prueba usando IA con Assistant API
   */
  async generateTestCases(request: AIGenerationRequest): Promise<AIGenerationResponse> {
    const startTime = Date.now();
    const generationId = `AI-GEN-${Date.now()}`;
    let totalTokensUsed = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    
    this.logger.log(`🚀 [${generationId}] INICIANDO GENERACIÓN DE TESTS CON ASSISTANT API`);
    this.logger.log(`📋 [${generationId}] Request: ${JSON.stringify(request, null, 2)}`);
    
    try {
      // Obtener el proyecto para usar su path
      const project = await this.projectRepository.findOneBy({ id: request.projectId });
      if (!project) {
        throw new Error(`Project with ID ${request.projectId} not found`);
      }
      
      this.logger.log(`📁 [${generationId}] Proyecto encontrado: ${project.name} (${project.path})`);
      
      // Crear directorio de debug en la raíz de playwright-workspaces
      const debugDir = path.join(path.dirname(project.path), 'debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }

      // Paso 1: Obtener Assistant existente
      this.logger.log(`🤖 [${generationId}] PASO 1: Obteniendo Assistant existente...`);
      const assistant = await this.assistantManagerService.getAssistant(request.projectId);
      if (!assistant) {
        this.logger.error(`❌ [${generationId}] ERROR: No existe un assistant creado para el proyecto ${request.projectId}. Debes inicializar el contexto IA antes de generar test cases.`);
        throw new Error(`No existe un assistant creado para el proyecto. Inicializa el contexto IA con el endpoint /ai/projects/:projectId/assistant/init antes de generar test cases.`);
      }
      this.logger.log(`✅ [${generationId}] Assistant listo: ${assistant.assistantId}`);

      // Paso 2: Crear Thread NUEVO para cada generación (evitar historial)
      this.logger.log(`🧵 [${generationId}] PASO 2: Creando Thread NUEVO para evitar historial...`);
      let thread = await this.threadManagerService.createThread(request.projectId, assistant.assistantId);
      this.logger.log(`✅ [${generationId}] Thread NUEVO creado: ${thread.threadId} (0/${thread.maxMessages} mensajes)`);

      // Paso 3: Construir prompt optimizado
      this.logger.log(`📝 [${generationId}] PASO 3: Construyendo prompt optimizado...`);
      const { prompt, featureContent, stepsContent } = await this.buildOptimizedPrompt(request);
      this.logger.log(`📤 [${generationId}] Prompt construido (${prompt.length} caracteres)`);
      
      // Guardar prompt enviado
      const promptPath = path.join(debugDir, `${generationId}-prompt.txt`);
      fs.writeFileSync(promptPath, prompt);
      this.logger.log(`📄 [${generationId}] Prompt guardado en: ${promptPath}`);

      // Paso 4: Enviar mensaje al assistant
      this.logger.log(`💬 [${generationId}] PASO 4: Enviando mensaje al assistant...`);
      const message = await this.openai.beta.threads.messages.create(thread.threadId, {
        role: 'user',
        content: prompt
      });
      this.logger.log(`✅ [${generationId}] Mensaje enviado: ${message.id}`);

      // Paso 5: Ejecutar run con optimizaciones de tokens
      this.logger.log(`▶️ [${generationId}] PASO 5: Ejecutando run con optimizaciones...`);
      const run = await this.openai.beta.threads.runs.create(thread.threadId, {
        assistant_id: assistant.assistantId,
        tool_choice: 'auto',
        truncation_strategy: { type: 'auto' }, // Recorta contexto antiguo automáticamente
      });
      this.logger.log(`✅ [${generationId}] Run optimizado iniciado: ${run.id} (status: ${run.status})`);

      // Paso 6: Esperar completación del run
      this.logger.log(`⏳ [${generationId}] PASO 6: Esperando completación del run...`);
      const result = await this.waitForRunCompletion(thread.threadId, run.id, generationId);
      this.logger.log(`✅ [${generationId}] Run completado: ${result.status}`);

      // Obtener tokens reales del run completado
      if (result.usage) {
        promptTokens = result.usage.prompt_tokens || 0;
        completionTokens = result.usage.completion_tokens || 0;
        totalTokensUsed = result.usage.total_tokens || 0;
        this.logger.log(`💰 [${generationId}] TOKENS REALES DEL RUN: Prompt=${promptTokens}, Completion=${completionTokens}, Total=${totalTokensUsed}`);
      } else {
        this.logger.warn(`⚠️ [${generationId}] No se encontraron datos de uso de tokens en el run`);
        this.logger.log(`🔍 [${generationId}] Estructura del run: ${JSON.stringify(result, null, 2)}`);
        
        // Intentar obtener usage desde los steps del run
        try {
          const runSteps = await this.openai.beta.threads.runs.steps.list(thread.threadId, run.id);
          this.logger.log(`🔍 [${generationId}] Analizando run steps para distribución de tokens...`);
          
          // Analizar cada step para entender distribución de tokens
          for (const step of runSteps.data) {
            if (step.step_details?.type === 'tool_calls') {
              const toolCalls = step.step_details.tool_calls;
              for (const toolCall of toolCalls) {
                if (toolCall.type === 'file_search') {
                  this.logger.log(`🔍 [${generationId}] Tool call: file_search ejecutado`);
                }
              }
            }
            
            if (step.step_details?.type === 'message_creation' && step.step_details.message_creation?.message_id) {
              const messageId = step.step_details.message_creation.message_id;
              const message = await this.openai.beta.threads.messages.retrieve(thread.threadId, messageId);
              if ((message as any).usage) {
                promptTokens = (message as any).usage.prompt_tokens || 0;
                completionTokens = (message as any).usage.completion_tokens || 0;
                totalTokensUsed = (message as any).usage.total_tokens || 0;
                this.logger.log(`💰 [${generationId}] TOKENS REALES DEL MESSAGE: Prompt=${promptTokens}, Completion=${completionTokens}, Total=${totalTokensUsed}`);
                break;
              }
            }
          }
        } catch (error) {
          this.logger.warn(`⚠️ [${generationId}] Error obteniendo usage de steps: ${error.message}`);
        }
      }

      // Paso 7: Obtener respuesta
      this.logger.log(`📥 [${generationId}] PASO 7: Obteniendo respuesta...`);
      const messages = await this.openai.beta.threads.messages.list(thread.threadId);
      const lastMessage = messages.data[0]; // El más reciente
      
      if (!lastMessage || !lastMessage.content || lastMessage.content.length === 0) {
        throw new Error('No se recibió respuesta del assistant');
      }

      const generatedText = lastMessage.content[0].type === 'text' 
        ? lastMessage.content[0].text.value 
        : 'No se pudo extraer texto de la respuesta';

      this.logger.log(`📥 [${generationId}] Respuesta recibida (${generatedText.length} caracteres)`);
      
      // Guardar respuesta bruta
      const responsePath = path.join(debugDir, `${generationId}-response.txt`);
      fs.writeFileSync(responsePath, generatedText);
      this.logger.log(`📄 [${generationId}] Respuesta guardada en: ${responsePath}`);
      
      // Guardar metadata de la respuesta con tokens reales
      const responseMetadata = {
        generationId,
        assistantId: assistant.assistantId,
        threadId: thread.threadId,
        runId: run.id,
        runStatus: result.status,
        messageId: lastMessage.id,
        tokenUsage: {
          promptTokens,
          completionTokens,
          totalTokens: totalTokensUsed,
        },
        timestamp: new Date().toISOString(),
      };
      
      const metadataPath = path.join(debugDir, `${generationId}-metadata.json`);
      fs.writeFileSync(metadataPath, JSON.stringify(responseMetadata, null, 2));
      this.logger.log(`📄 [${generationId}] Metadata guardada en: ${metadataPath}`);
      this.logger.log(`💰 [${generationId}] USO REAL DE TOKENS: Prompt=${promptTokens}, Completion=${completionTokens}, Total=${totalTokensUsed}`);

      // Paso 8: Incrementar contador de mensajes
      await this.threadManagerService.incrementMessageCount(thread.threadId);
      this.logger.log(`📊 [${generationId}] Contador de mensajes incrementado`);

      // Paso 9: Parsear la respuesta para extraer código
      this.logger.log(`🔍 [${generationId}] PASO 9: Parseando respuesta...`);
      const parsedCode = this.codeParsingService.parseGeneratedCode(generatedText);
      this.logger.log(`✅ [${generationId}] Código parseado: ${JSON.stringify(parsedCode, null, 2)}`);
      
      // Paso 10: Analizar archivos existentes y determinar inserción
      this.logger.log(`🔍 [${generationId}] PASO 10: Analizando archivos existentes...`);
      const insertions = await this.testCaseAnalysisService.analyzeAndDetermineInsertions(request, parsedCode, generationId);
      this.logger.log(`✅ [${generationId}] Inserciones determinadas: ${JSON.stringify(insertions, null, 2)}`);
      
      // Paso 11: Insertar código en archivos
      this.logger.log(`📝 [${generationId}] PASO 11: Insertando código en archivos...`);
      const insertionResult = await this.codeInsertionService.insertCode(insertions, generationId);
      this.logger.log(`✅ [${generationId}] Resultado de inserción: ${JSON.stringify(insertionResult, null, 2)}`);

      // Paso 12: Los archivos se incluyen directamente en el prompt (no vector store)
      this.logger.log(`📤 [${generationId}] PASO 12: Archivos incluidos directamente en el prompt`);
      this.logger.log(`📤 [${generationId}] Feature content length: ${featureContent?.length || 0} caracteres`);
      this.logger.log(`📤 [${generationId}] Steps content length: ${stepsContent?.length || 0} caracteres`);

      const processingTime = Date.now() - startTime;

      this.logger.log(`🎉 [${generationId}] GENERACIÓN COMPLETADA en ${processingTime}ms`);
      this.logger.log(`💰 [${generationId}] TOKENS FINALES REALES: ${totalTokensUsed}`);

      // Guardar resumen final con tokens reales
      const summary = {
        generationId,
        request,
        assistantId: assistant.assistantId,
        threadId: thread.threadId,
        runId: run.id,
        newCode: parsedCode,
        insertions,
        insertionResult,
        processingTime,
        tokenUsage: {
          promptTokens,
          completionTokens,
          totalTokens: totalTokensUsed,
        },
        success: true,
        timestamp: new Date().toISOString(),
      };
      
      const summaryPath = path.join(debugDir, `${generationId}-summary.json`);
      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
      this.logger.log(`📄 [${generationId}] Resumen guardado en: ${summaryPath}`);

      return {
        success: true,
        data: {
          newCode: parsedCode,
          insertions,
        },
        metadata: {
          processingTime,
          tokensUsed: totalTokensUsed,
          modelUsed: assistant.model,
          generationId,
          assistantId: assistant.assistantId,
          threadId: thread.threadId,
        },
      };

    } catch (error) {
      this.logger.error(`❌ [${generationId}] ERROR en generación de tests: ${error.message}`);
      this.logger.error(`❌ [${generationId}] Stack trace: ${error.stack}`);
      this.logger.error(`💰 [${generationId}] TOKENS CONSUMIDOS ANTES DEL ERROR: ${totalTokensUsed}`);
      
      // Guardar error con tokens
      const errorLog = {
        generationId,
        request,
        error: error.message,
        stack: error.stack,
        tokenUsage: {
          promptTokens,
          completionTokens,
          totalTokens: totalTokensUsed,
        },
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
          tokensUsed: totalTokensUsed,
          modelUsed: 'gpt-4o-mini',
          generationId,
        },
      };
    }
  }

  /**
   * Construye un prompt optimizado para la generación de test cases.
   * Este prompt incluye los archivos actuales directamente.
   */
  private async buildOptimizedPrompt(request: AIGenerationRequest): Promise<{ prompt: string; featureContent: string; stepsContent: string }> {
    // Obtener archivos actuales de la entidad
    const project = await this.projectRepository.findOneBy({ id: request.projectId });
    if (!project) {
      throw new Error(`Project with ID ${request.projectId} not found`);
    }

    let featureContent = '';
    let stepsContent = '';
    let featurePath = '';
    let stepsPath = '';

    // Buscar el endpoint para obtener los archivos generados
    const endpoint = await this.endpointRepository.findOne({ 
      where: { projectId: request.projectId, section: request.section, entityName: request.entityName } 
    });

    if (endpoint && endpoint.generatedArtifacts) {
      // Parsear generatedArtifacts si es string JSON
      let artifacts: any;
      try {
        artifacts = typeof endpoint.generatedArtifacts === 'string'
          ? JSON.parse(endpoint.generatedArtifacts)
          : endpoint.generatedArtifacts;
        
        this.logger.log(`📁 [PROMPT] GeneratedArtifacts parseado: ${JSON.stringify(artifacts, null, 2)}`);
      } catch (e) {
        this.logger.warn(`⚠️ Error parseando generatedArtifacts: ${e.message}`);
        artifacts = {};
      }

      // Leer archivo feature si existe
      if (artifacts.feature) {
        featurePath = path.join(project.path, artifacts.feature);
        this.logger.log(`📁 [PROMPT] Intentando leer feature file: ${featurePath}`);
        
        if (fs.existsSync(featurePath)) {
          featureContent = fs.readFileSync(featurePath, 'utf-8');
          this.logger.log(`✅ [PROMPT] Feature file leído exitosamente (${featureContent.length} caracteres)`);
        } else {
          this.logger.warn(`⚠️ [PROMPT] Feature file no encontrado: ${featurePath}`);
        }
      } else {
        this.logger.warn(`⚠️ [PROMPT] No se encontró ruta de feature en generatedArtifacts`);
      }

      // Leer archivo steps si existe
      if (artifacts.steps) {
        stepsPath = path.join(project.path, artifacts.steps);
        this.logger.log(`📁 [PROMPT] Intentando leer steps file: ${stepsPath}`);
        
        if (fs.existsSync(stepsPath)) {
          stepsContent = fs.readFileSync(stepsPath, 'utf-8');
          this.logger.log(`✅ [PROMPT] Steps file leído exitosamente (${stepsContent.length} caracteres)`);
        } else {
          this.logger.warn(`⚠️ [PROMPT] Steps file no encontrado: ${stepsPath}`);
        }
      } else {
        this.logger.warn(`⚠️ [PROMPT] No se encontró ruta de steps en generatedArtifacts`);
      }
    } else {
      this.logger.warn(`⚠️ [PROMPT] No se encontró endpoint o generatedArtifacts para ${request.entityName} (${request.section})`);
    }

    return {
      prompt: `Genera tests para "${request.entityName}" (${request.section}).

OPERACIÓN: ${request.operation}
REQUISITOS: ${request.requirements}

📁 ARCHIVOS ACTUALES INCLUIDOS EN EL PROMPT:

=== FEATURE FILE (${featurePath || 'No existe'}) ===
${featureContent || 'No existe archivo feature para esta entidad'}

=== STEPS FILE (${stepsPath || 'No existe'}) ===
${stepsContent || 'No existe archivo steps para esta entidad'}

📋 INSTRUCCIONES DETALLADAS:

1. **ANÁLISIS DE ARCHIVOS EXISTENTES:**
   - Revisa el FEATURE FILE para ver qué escenarios ya existen
   - Revisa el STEPS FILE para ver qué steps ya están implementados
   - NO dupliques escenarios ni steps existentes
   - Identifica el siguiente ID incremental disponible

2. **GENERACIÓN DE NUEVO CONTENIDO:**
   - Si no existe feature file: Crea uno nuevo con escenarios Gherkin
   - Si existe feature file: Agrega solo el nuevo escenario solicitado
   - Si no existe steps file: Crea uno nuevo con steps de Cucumber
   - Si existe steps file: Agrega solo los steps que faltan

3. **REGLAS ESTRICTAS:**
   - SOLO APIs REST
   - NO incluyas "Feature:" ni rutas en la respuesta
   - Usa clientes API existentes (ProductClient, etc.)
   - Respeta secciones: Given antes de "// When steps", When antes de "// Then steps"
   - Agrega tag del feature y el ID incremental: @TC-${request.section}-{entityName}-{Number}
   - NO incluyas imports duplicados
   - Mantén el formato y estructura existente
   - Usa imports específicos solo si son necesarios

4. **FORMATO DE RESPUESTA OBLIGATORIO:**
   DEBES usar exactamente este formato para que el sistema pueda procesar tu respuesta:

   ***Features:***
   [Aquí va el código completo del feature/scenario]

   ***Steps:***
   [Aquí va el código de los steps]

   - Si solo agregas feature: Deja ***Steps:*** vacío
   - Si solo agregas steps: Deja ***Features:*** vacío
   - Si agregas ambos: Incluye ambos bloques
   - NO incluyas otros marcadores ni comentarios fuera de estos bloques
   - NO incluyas comentarios explicativos fuera de los bloques

5. **ESTRUCTURA ESPECÍFICA:**
   - FEATURE: Incluye tags (@create, @smoke, etc.) y el escenario completo
   - STEPS: Incluye solo el step nuevo, sin imports si ya existen
   - Mantén la indentación y formato exacto del archivo existente

Genera SOLO el código necesario para completar la operación solicitada usando el formato especificado.`,
      featureContent,
      stepsContent
    };
  }

  /**
   * Espera a que un run se complete
   */
  private async waitForRunCompletion(threadId: string, runId: string, generationId: string): Promise<any> {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutos máximo (60 * 5 segundos)
    
    while (attempts < maxAttempts) {
      attempts++;
      this.logger.log(`⏳ [${generationId}] Verificando run (intento ${attempts}/${maxAttempts})...`);
      
      const run = await this.openai.beta.threads.runs.retrieve(threadId, runId);
      
      this.logger.log(`📊 [${generationId}] Run status: ${run.status}`);
      
      if (run.status === 'completed') {
        this.logger.log(`✅ [${generationId}] Run completado exitosamente`);
        
        // Logging detallado de tokens
        if (run.usage) {
          this.logger.log(`💰 [${generationId}] TOKENS DETALLADOS:`);
          this.logger.log(`   - Prompt: ${run.usage.prompt_tokens || 0}`);
          this.logger.log(`   - Completion: ${run.usage.completion_tokens || 0}`);
          this.logger.log(`   - Total: ${run.usage.total_tokens || 0}`);
          
          // Análisis de optimización
          if ((run.usage.prompt_tokens || 0) > 3000) {
            this.logger.warn(`⚠️ [${generationId}] PROMPT MUY ALTO: ${run.usage.prompt_tokens}. Revisar system prompt y tools.`);
          }
          
          if ((run.usage.total_tokens || 0) > 2000) {
            this.logger.warn(`⚠️ [${generationId}] TOTAL MUY ALTO: ${run.usage.total_tokens}. Revisar optimizaciones.`);
          }
        }
        
        return run;
      }
      
      if (run.status === 'failed') {
        this.logger.error(`❌ [${generationId}] Run falló: ${run.last_error?.message || 'Error desconocido'}`);
        throw new Error(`Run failed: ${run.last_error?.message || 'Error desconocido'}`);
      }
      
      if (run.status === 'cancelled') {
        this.logger.error(`❌ [${generationId}] Run cancelado`);
        throw new Error('Run was cancelled');
      }
      
      if (run.status === 'expired') {
        this.logger.error(`❌ [${generationId}] Run expirado`);
        throw new Error('Run expired');
      }
      
      // Esperar 5 segundos antes del siguiente intento
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    throw new Error(`Run timeout after ${maxAttempts} attempts`);
  }
}