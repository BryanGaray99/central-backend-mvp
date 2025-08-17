import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../../projects/project.entity';
import { Endpoint } from '../../endpoints/endpoint.entity';
import { AISuggestion } from '../entities/ai-suggestion.entity';
import { AssistantManagerService } from './assistant-manager.service';
import { ThreadManagerService } from './thread-manager.service';
import { TestCaseSuggestionRequestDto, TestCaseSuggestionDto } from '../dto/test-case-suggestion.dto';

@Injectable()
export class TestCaseSuggestionService {
  private readonly logger = new Logger(TestCaseSuggestionService.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Endpoint)
    private readonly endpointRepository: Repository<Endpoint>,
    @InjectRepository(AISuggestion)
    private readonly aiSuggestionRepository: Repository<AISuggestion>,
    private readonly assistantManagerService: AssistantManagerService,
    private readonly threadManagerService: ThreadManagerService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  /**
   * Genera sugerencias de test cases usando IA
   */
  async generateSuggestions(
    projectId: string, 
    request: TestCaseSuggestionRequestDto
  ): Promise<TestCaseSuggestionDto[]> {
    const startTime = Date.now();
    const suggestionId = `AI-SUGGEST-${Date.now()}`;
    
    this.logger.log(`🚀 [${suggestionId}] INICIANDO GENERACIÓN DE SUGERENCIAS DE TEST CASES`);
    this.logger.log(`📋 [${suggestionId}] Request: ${JSON.stringify(request, null, 2)}`);
    
    try {
      // Obtener el proyecto para usar su path
      const project = await this.projectRepository.findOneBy({ id: projectId });
      if (!project) {
        throw new Error(`Project with ID ${projectId} not found`);
      }
      
      this.logger.log(`📁 [${suggestionId}] Proyecto encontrado: ${project.name} (${project.path})`);
      
      // Crear directorio de debug en la raíz de playwright-workspaces
      const debugDir = path.join(path.dirname(project.path), 'debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }

      // Paso 1: Obtener Assistant existente
      this.logger.log(`🤖 [${suggestionId}] PASO 1: Obteniendo Assistant existente...`);
      const assistant = await this.assistantManagerService.getAssistant(projectId);
      if (!assistant) {
        this.logger.error(`❌ [${suggestionId}] ERROR: No existe un assistant creado para el proyecto ${projectId}. Debes inicializar el contexto IA primero.`);
        throw new Error(`No existe un assistant creado para el proyecto. Inicializa el contexto IA con el endpoint /ai/projects/:projectId/assistant/init antes de generar sugerencias.`);
      }
      this.logger.log(`✅ [${suggestionId}] Assistant listo: ${assistant.assistantId}`);

      // Paso 2: Crear Thread NUEVO para evitar historial
      this.logger.log(`🧵 [${suggestionId}] PASO 2: Creando Thread NUEVO...`);
      let thread = await this.threadManagerService.createThread(projectId, assistant.assistantId);
      this.logger.log(`✅ [${suggestionId}] Thread NUEVO creado: ${thread.threadId}`);

      // Paso 3: Construir prompt para sugerencias
      this.logger.log(`📝 [${suggestionId}] PASO 3: Construyendo prompt para sugerencias...`);
      const { prompt, featureContent, stepsContent } = await this.buildSuggestionPrompt(projectId, request);
      this.logger.log(`📤 [${suggestionId}] Prompt construido (${prompt.length} caracteres)`);
      
      // Guardar prompt enviado
      const promptPath = path.join(debugDir, 'ai-suggestion-prompt.txt');
      fs.writeFileSync(promptPath, prompt);
      this.logger.log(`📄 [${suggestionId}] Prompt guardado en: ${promptPath}`);

      // Paso 4: Enviar mensaje al assistant
      this.logger.log(`💬 [${suggestionId}] PASO 4: Enviando mensaje al assistant...`);
      const message = await this.openai.beta.threads.messages.create(thread.threadId, {
        role: 'user',
        content: prompt
      });
      this.logger.log(`✅ [${suggestionId}] Mensaje enviado: ${message.id}`);

      // Paso 5: Ejecutar run
      this.logger.log(`▶️ [${suggestionId}] PASO 5: Ejecutando run...`);
      const run = await this.openai.beta.threads.runs.create(thread.threadId, {
        assistant_id: assistant.assistantId,
        tool_choice: 'auto',
        truncation_strategy: { type: 'auto' },
      });
      this.logger.log(`✅ [${suggestionId}] Run iniciado: ${run.id} (status: ${run.status})`);

      // Paso 6: Esperar completación del run
      this.logger.log(`⏳ [${suggestionId}] PASO 6: Esperando completación del run...`);
      const result = await this.waitForRunCompletion(thread.threadId, run.id, suggestionId);
      this.logger.log(`✅ [${suggestionId}] Run completado: ${result.status}`);

      // Paso 7: Obtener respuesta
      this.logger.log(`📥 [${suggestionId}] PASO 7: Obteniendo respuesta...`);
      const messages = await this.openai.beta.threads.messages.list(thread.threadId);
      const lastMessage = messages.data[0]; // El más reciente
      
      if (!lastMessage || !lastMessage.content || lastMessage.content.length === 0) {
        throw new Error('No se recibió respuesta del assistant');
      }

      const generatedText = lastMessage.content[0].type === 'text' 
        ? lastMessage.content[0].text.value 
        : 'No se pudo extraer texto de la respuesta';

      this.logger.log(`📥 [${suggestionId}] Respuesta recibida (${generatedText.length} caracteres)`);
      
      // Guardar respuesta bruta
      const responsePath = path.join(debugDir, 'ai-suggestion-response.txt');
      fs.writeFileSync(responsePath, generatedText);
      this.logger.log(`📄 [${suggestionId}] Respuesta guardada en: ${responsePath}`);

      // Paso 8: Incrementar contador de mensajes
      await this.threadManagerService.incrementMessageCount(thread.threadId);
      this.logger.log(`📊 [${suggestionId}] Contador de mensajes incrementado`);

      // Paso 9: Parsear la respuesta para extraer sugerencias
      this.logger.log(`🔍 [${suggestionId}] PASO 9: Parseando sugerencias...`);
      const suggestions = this.parseSuggestions(generatedText);
      this.logger.log(`✅ [${suggestionId}] Sugerencias parseadas: ${suggestions.length} encontradas`);

      const processingTime = Date.now() - startTime;
      this.logger.log(`🎉 [${suggestionId}] GENERACIÓN DE SUGERENCIAS COMPLETADA en ${processingTime}ms`);

      // Paso 10: Guardar sugerencias en la base de datos
      this.logger.log(`💾 [${suggestionId}] PASO 10: Guardando sugerencias en BD...`);
      const aiSuggestion = new AISuggestion();
      aiSuggestion.suggestionId = suggestionId;
      aiSuggestion.projectId = projectId;
      aiSuggestion.entityName = request.entityName;
      aiSuggestion.section = request.section;
      aiSuggestion.requirements = request.requirements;
      aiSuggestion.suggestions = suggestions;
      aiSuggestion.totalSuggestions = suggestions.length;
      aiSuggestion.assistantId = assistant.assistantId;
      aiSuggestion.threadId = thread.threadId;
      aiSuggestion.runId = run.id;
      aiSuggestion.processingTime = processingTime;
      aiSuggestion.status = 'completed';
      aiSuggestion.metadata = {
        featureContentLength: featureContent.length,
        stepsContentLength: stepsContent.length,
        promptLength: prompt.length,
        responseLength: generatedText.length,
      };

      const savedSuggestion = await this.aiSuggestionRepository.save(aiSuggestion);
      this.logger.log(`✅ [${suggestionId}] Sugerencias guardadas en BD con ID: ${savedSuggestion.id}`);

      // Guardar resumen final
      const summary = {
        suggestionId,
        request,
        assistantId: assistant.assistantId,
        threadId: thread.threadId,
        runId: run.id,
        suggestions,
        processingTime,
        success: true,
        timestamp: new Date().toISOString(),
        dbId: savedSuggestion.id,
      };
      
      const summaryPath = path.join(debugDir, 'ai-suggestion-summary.json');
      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
      this.logger.log(`📄 [${suggestionId}] Resumen guardado en: ${summaryPath}`);

      return suggestions;

    } catch (error) {
      this.logger.error(`❌ [${suggestionId}] ERROR en generación de sugerencias: ${error.message}`);
      this.logger.error(`❌ [${suggestionId}] Stack trace: ${error.stack}`);
      
      // Guardar error en la base de datos
      try {
        const aiSuggestion = new AISuggestion();
        aiSuggestion.suggestionId = suggestionId;
        aiSuggestion.projectId = projectId;
        aiSuggestion.entityName = request.entityName;
        aiSuggestion.section = request.section;
        aiSuggestion.requirements = request.requirements;
        aiSuggestion.suggestions = [];
        aiSuggestion.totalSuggestions = 0;
        aiSuggestion.status = 'failed';
        aiSuggestion.errorMessage = error.message;
        aiSuggestion.processingTime = Date.now() - startTime;
        aiSuggestion.metadata = {
          error: error.message,
          stack: error.stack,
          request,
        };

        await this.aiSuggestionRepository.save(aiSuggestion);
        this.logger.log(`💾 [${suggestionId}] Error guardado en BD`);
      } catch (dbError) {
        this.logger.error(`❌ [${suggestionId}] Error guardando en BD: ${dbError.message}`);
      }
      
      // Guardar error en archivo
      const errorLog = {
        suggestionId,
        request,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      };
      
      // Obtener el proyecto para usar su path
      const project = await this.projectRepository.findOneBy({ id: projectId });
      if (project) {
        const debugDir = path.join(path.dirname(project.path), 'debug');
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }
        
        const errorPath = path.join(debugDir, 'ai-suggestion-error.json');
        fs.writeFileSync(errorPath, JSON.stringify(errorLog, null, 2));
        this.logger.log(`📄 [${suggestionId}] Error guardado en: ${errorPath}`);
      }
      
      throw error;
    }
  }

  /**
   * Construye un prompt optimizado para generar sugerencias de test cases
   */
  private async buildSuggestionPrompt(projectId: string, request: TestCaseSuggestionRequestDto): Promise<{ prompt: string; featureContent: string; stepsContent: string }> {
    // Obtener archivos actuales de la entidad
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`);
    }

    let featureContent = '';
    let stepsContent = '';
    let featurePath = '';
    let stepsPath = '';

    // Buscar el endpoint para obtener los archivos generados
    const endpoint = await this.endpointRepository.findOne({ 
      where: { projectId: projectId, section: request.section, entityName: request.entityName } 
    });

    if (endpoint && endpoint.generatedArtifacts) {
      // Parsear generatedArtifacts si es string JSON
      let artifacts: any;
      try {
        artifacts = typeof endpoint.generatedArtifacts === 'string'
          ? JSON.parse(endpoint.generatedArtifacts)
          : endpoint.generatedArtifacts;
        
        this.logger.log(`📁 [SUGGESTION] GeneratedArtifacts parseado: ${JSON.stringify(artifacts, null, 2)}`);
      } catch (e) {
        this.logger.warn(`⚠️ Error parseando generatedArtifacts: ${e.message}`);
        artifacts = {};
      }

      // Leer archivo feature si existe
      if (artifacts.feature) {
        featurePath = path.join(project.path, artifacts.feature);
        this.logger.log(`📁 [SUGGESTION] Intentando leer feature file: ${featurePath}`);
        
        if (fs.existsSync(featurePath)) {
          featureContent = fs.readFileSync(featurePath, 'utf-8');
          this.logger.log(`✅ [SUGGESTION] Feature file leído exitosamente (${featureContent.length} caracteres)`);
        } else {
          this.logger.warn(`⚠️ [SUGGESTION] Feature file no encontrado: ${featurePath}`);
        }
      }

      // Leer archivo steps si existe
      if (artifacts.steps) {
        stepsPath = path.join(project.path, artifacts.steps);
        this.logger.log(`📁 [SUGGESTION] Intentando leer steps file: ${stepsPath}`);
        
        if (fs.existsSync(stepsPath)) {
          stepsContent = fs.readFileSync(stepsPath, 'utf-8');
          this.logger.log(`✅ [SUGGESTION] Steps file leído exitosamente (${stepsContent.length} caracteres)`);
        } else {
          this.logger.warn(`⚠️ [SUGGESTION] Steps file no encontrado: ${stepsPath}`);
        }
      }
    }

    return {
      prompt: `Genera 5 sugerencias de casos de prueba para "${request.entityName}" (${request.section}).

REQUISITOS DEL USUARIO: ${request.requirements}

📁 ARCHIVOS ACTUALES INCLUIDOS EN EL PROMPT:

=== FEATURE FILE (${featurePath || 'No existe'}) ===
${featureContent || 'No existe archivo feature para esta entidad'}

=== STEPS FILE (${stepsPath || 'No existe'}) ===
${stepsContent || 'No existe archivo steps para esta entidad'}

📋 INSTRUCCIONES DETALLADAS:

1. **ANÁLISIS DE ARCHIVOS EXISTENTES:**
   - Revisa el FEATURE FILE para ver qué escenarios ya existen
   - Revisa el STEPS FILE para ver qué steps ya están implementados
   - NO sugieras casos de prueba que ya existan
   - Identifica áreas de cobertura que podrían faltar

2. **GENERACIÓN DE SUGERENCIAS:**
   - Genera EXACTAMENTE 5 sugerencias
   - Cada sugerencia debe ser única y aportar valor
   - Enfócate en casos edge, validaciones, y escenarios de error
   - Considera casos positivos y negativos
   - Mantén las sugerencias concisas pero informativas

3. **REGLAS ESTRICTAS:**
   - SOLO APIs REST
   - NO dupliques escenarios existentes
   - Las sugerencias deben ser específicas y accionables
   - Considera diferentes tipos de testing: unit, integration, e2e
   - Enfócate en cobertura de código y casos edge

4. **FORMATO DE RESPUESTA OBLIGATORIO:**
   DEBES usar exactamente este formato para que el sistema pueda procesar tu respuesta:

   ***Suggestion 1:***
   **Short Prompt:** [Prompt corto y descriptivo]
   **Short Description:** [Descripción breve del caso de prueba]
   **Detailed Description:** [Descripción detallada explicando el propósito y cobertura]

   ***Suggestion 2:***
   **Short Prompt:** [Prompt corto y descriptivo]
   **Short Description:** [Descripción breve del caso de prueba]
   **Detailed Description:** [Descripción detallada explicando el propósito y cobertura]

   [Continuar para las 5 sugerencias...]

5. **ESTRUCTURA ESPECÍFICA:**
   - SHORT PROMPT: Máximo 10 palabras, claro y directo
   - SHORT DESCRIPTION: Máximo 20 palabras, explica qué valida
   - DETAILED DESCRIPTION: Máximo 100 palabras, explica el propósito, cobertura y valor

Genera SOLO las 5 sugerencias usando el formato especificado. NO incluyas otros comentarios ni explicaciones fuera del formato requerido.`,
      featureContent,
      stepsContent
    };
  }

  /**
   * Parsear la respuesta del assistant para extraer las sugerencias
   */
  private parseSuggestions(generatedText: string): TestCaseSuggestionDto[] {
    const suggestions: TestCaseSuggestionDto[] = [];
    
    // Buscar patrones de sugerencias en el texto
    const suggestionPattern = /\*\*\*Suggestion (\d+):\*\*\*\s*\*\*Short Prompt:\*\*\s*([^\n]+)\s*\*\*Short Description:\*\*\s*([^\n]+)\s*\*\*Detailed Description:\*\*\s*([^\n]+)/g;
    
    let match;
    while ((match = suggestionPattern.exec(generatedText)) !== null) {
      const suggestion: TestCaseSuggestionDto = {
        shortPrompt: match[2].trim(),
        shortDescription: match[3].trim(),
        detailedDescription: match[4].trim()
      };
      suggestions.push(suggestion);
    }

    // Si no se encontraron sugerencias con el patrón, intentar parsear de otra manera
    if (suggestions.length === 0) {
      this.logger.warn('No se pudieron parsear sugerencias con el patrón estándar, intentando parseo alternativo...');
      
      // Parseo alternativo más flexible
      const lines = generatedText.split('\n');
      let currentSuggestion: Partial<TestCaseSuggestionDto> = {};
      
      for (const line of lines) {
        if (line.includes('Short Prompt:')) {
          if (Object.keys(currentSuggestion).length === 3) {
            suggestions.push(currentSuggestion as TestCaseSuggestionDto);
            currentSuggestion = {};
          }
          currentSuggestion.shortPrompt = line.split('Short Prompt:')[1]?.trim() || '';
        } else if (line.includes('Short Description:')) {
          currentSuggestion.shortDescription = line.split('Short Description:')[1]?.trim() || '';
        } else if (line.includes('Detailed Description:')) {
          currentSuggestion.detailedDescription = line.split('Detailed Description:')[1]?.trim() || '';
        }
      }
      
      // Agregar la última sugerencia si está completa
      if (Object.keys(currentSuggestion).length === 3) {
        suggestions.push(currentSuggestion as TestCaseSuggestionDto);
      }
    }

    // Si aún no hay sugerencias, crear sugerencias por defecto basadas en el texto
    if (suggestions.length === 0) {
      this.logger.warn('No se pudieron parsear sugerencias, creando sugerencias por defecto...');
      
      // Crear sugerencias básicas basadas en el contexto
      const defaultSuggestions = [
        {
          shortPrompt: 'Validate required fields',
          shortDescription: 'Test API validation for missing required fields',
          detailedDescription: 'This test case validates that the API correctly returns validation errors when required fields are missing from the request body.'
        },
        {
          shortPrompt: 'Test successful creation',
          shortDescription: 'Verify successful resource creation with valid data',
          detailedDescription: 'This test case ensures that the API successfully creates a resource when all required fields are provided with valid data.'
        },
        {
          shortPrompt: 'Test error handling',
          shortDescription: 'Validate proper error responses for invalid data',
          detailedDescription: 'This test case verifies that the API returns appropriate error messages and status codes when invalid data is submitted.'
        },
        {
          shortPrompt: 'Test edge cases',
          shortDescription: 'Validate behavior with boundary values and edge cases',
          detailedDescription: 'This test case covers edge cases such as maximum/minimum values, empty strings, and boundary conditions.'
        },
        {
          shortPrompt: 'Test data integrity',
          shortDescription: 'Verify data consistency and integrity after operations',
          detailedDescription: 'This test case ensures that data remains consistent and accurate after create, update, or delete operations.'
        }
      ];
      
      suggestions.push(...defaultSuggestions);
    }

    this.logger.log(`✅ Sugerencias parseadas exitosamente: ${suggestions.length}`);
    return suggestions;
  }

  /**
   * Obtiene todas las sugerencias de un proyecto
   */
  async getProjectSuggestions(projectId: string): Promise<AISuggestion[]> {
    return await this.aiSuggestionRepository.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Obtiene sugerencias por entidad y sección
   */
  async getSuggestionsByEntityAndSection(
    projectId: string, 
    entityName: string, 
    section: string
  ): Promise<AISuggestion[]> {
    return await this.aiSuggestionRepository.find({
      where: { projectId, entityName, section },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Obtiene una sugerencia específica por ID
   */
  async getSuggestionById(suggestionId: string): Promise<AISuggestion | null> {
    return await this.aiSuggestionRepository.findOne({
      where: { suggestionId },
    });
  }

  /**
   * Elimina una sugerencia
   */
  async deleteSuggestion(suggestionId: string): Promise<void> {
    const suggestion = await this.aiSuggestionRepository.findOne({
      where: { suggestionId },
    });
    
    if (suggestion) {
      await this.aiSuggestionRepository.remove(suggestion);
      this.logger.log(`🗑️ Sugerencia eliminada: ${suggestionId}`);
    }
  }

  /**
   * Obtiene estadísticas de sugerencias de un proyecto
   */
  async getSuggestionStats(projectId: string): Promise<{
    total: number;
    completed: number;
    failed: number;
    totalSuggestions: number;
    averageProcessingTime: number;
  }> {
    const suggestions = await this.aiSuggestionRepository.find({
      where: { projectId },
    });

    const total = suggestions.length;
    const completed = suggestions.filter(s => s.status === 'completed').length;
    const failed = suggestions.filter(s => s.status === 'failed').length;
    const totalSuggestions = suggestions.reduce((sum, s) => sum + s.totalSuggestions, 0);
    const averageProcessingTime = suggestions.length > 0 
      ? suggestions.reduce((sum, s) => sum + (s.processingTime || 0), 0) / suggestions.length 
      : 0;

    return {
      total,
      completed,
      failed,
      totalSuggestions,
      averageProcessingTime,
    };
  }

  /**
   * Espera a que un run se complete
   */
  private async waitForRunCompletion(threadId: string, runId: string, suggestionId: string): Promise<any> {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutos máximo (60 * 5 segundos)
    
    while (attempts < maxAttempts) {
      attempts++;
      this.logger.log(`⏳ [${suggestionId}] Verificando run (intento ${attempts}/${maxAttempts})...`);
      
      const run = await this.openai.beta.threads.runs.retrieve(threadId, runId);
      
      this.logger.log(`📊 [${suggestionId}] Run status: ${run.status}`);
      
      if (run.status === 'completed') {
        this.logger.log(`✅ [${suggestionId}] Run completado exitosamente`);
        return run;
      }
      
      if (run.status === 'failed') {
        this.logger.error(`❌ [${suggestionId}] Run falló: ${run.last_error?.message || 'Error desconocido'}`);
        throw new Error(`Run failed: ${run.last_error?.message || 'Error desconocido'}`);
      }
      
      if (run.status === 'cancelled') {
        this.logger.error(`❌ [${suggestionId}] Run cancelado`);
        throw new Error('Run was cancelled');
      }
      
      if (run.status === 'expired') {
        this.logger.error(`❌ [${suggestionId}] Run expirado`);
        throw new Error('Run expired');
      }
      
      // Esperar 5 segundos antes del siguiente intento
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    throw new Error(`Run timeout after ${maxAttempts} attempts`);
  }
}
