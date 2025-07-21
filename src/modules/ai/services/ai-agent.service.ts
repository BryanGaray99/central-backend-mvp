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
import { testGenerationTool } from '../tools/test-generation-tool';
import { codeAnalysisTool } from '../tools/code-analysis-tool';
import { locationAnalyzerTool } from '../tools/location-analyzer-tool';
import { codeInserterTool } from '../tools/code-inserter-tool';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../../projects/project.entity';

@Injectable()
export class AIAgentService {
  private readonly logger = new Logger(AIAgentService.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
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
      const insertions = await this.analyzeAndDetermineInsertions(request, newCode, generationId);
      this.logger.log(`✅ [${generationId}] Inserciones determinadas: ${JSON.stringify(insertions, null, 2)}`);
      
      // Paso 3: Insertar código en archivos
      this.logger.log(`📝 [${generationId}] PASO 3: Insertando código en archivos...`);
      const insertionResult = await this.insertCode(request, insertions, generationId);
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
          tokensUsed: 0, // TODO: Extraer de respuesta de OpenAI
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
    const parsedCode = this.parseGeneratedCode(generatedText);
    this.logger.log(`✅ [${generationId}] Código parseado: ${JSON.stringify(parsedCode, null, 2)}`);
    
    return parsedCode;
  }

  /**
   * Paso 2: Analizar archivos existentes y determinar inserción
   */
  private async analyzeAndDetermineInsertions(
    request: AIGenerationRequest, 
    newCode: GeneratedCode,
    generationId: string
  ): Promise<CodeInsertion[]> {
    this.logger.log(`🔍 [${generationId}] Analizando archivos existentes...`);
    
    // Obtener el proyecto para usar su path
    const project = await this.projectRepository.findOneBy({ id: request.projectId });
    if (!project) {
      throw new Error(`Project with ID ${request.projectId} not found`);
    }
    
    this.logger.log(`📁 [${generationId}] Proyecto encontrado: ${project.name}`);
    this.logger.log(`📁 [${generationId}] Path del proyecto: ${project.path}`);
    
    const insertions: CodeInsertion[] = [];
    
    // Analizar archivo feature
    if (newCode.feature) {
      this.logger.log(`🔍 [${generationId}] Analizando archivo feature...`);
      const featurePath = path.join(project.path, `src/features/${request.section}/${request.entityName.toLowerCase()}.feature`);
      this.logger.log(`📄 [${generationId}] Ruta del archivo feature: ${featurePath}`);
      this.logger.log(`📄 [${generationId}] ¿Existe el archivo feature? ${fs.existsSync(featurePath)}`);
      
      const featureInsertion = await this.analyzeFeatureFile(featurePath, newCode.feature, generationId);
      if (featureInsertion) {
        this.logger.log(`✅ [${generationId}] Inserción de feature encontrada: línea ${featureInsertion.line}`);
        insertions.push(featureInsertion);
      } else {
        this.logger.log(`⚠️ [${generationId}] No se pudo determinar inserción para feature`);
      }
    } else {
      this.logger.log(`⚠️ [${generationId}] No hay código feature para analizar`);
    }
    
    // Analizar archivo steps
    if (newCode.steps) {
      this.logger.log(`🔍 [${generationId}] Analizando archivo steps...`);
      const stepsPath = path.join(project.path, `src/steps/${request.section}/${request.entityName.toLowerCase()}.steps.ts`);
      this.logger.log(`📄 [${generationId}] Ruta del archivo steps: ${stepsPath}`);
      this.logger.log(`📄 [${generationId}] ¿Existe el archivo steps? ${fs.existsSync(stepsPath)}`);
      
      const stepsInsertions = await this.analyzeStepsFile(stepsPath, newCode.steps, generationId);
      this.logger.log(`✅ [${generationId}] Inserciones de steps encontradas: ${stepsInsertions.length}`);
      insertions.push(...stepsInsertions);
    } else {
      this.logger.log(`⚠️ [${generationId}] No hay código steps para analizar`);
    }
    
    this.logger.log(`📊 [${generationId}] Total de inserciones determinadas: ${insertions.length}`);
    this.logger.log(`✅ [${generationId}] Inserciones determinadas: ${JSON.stringify(insertions, null, 2)}`);
    
    return insertions;
  }

  /**
   * Paso 3: Insertar código en archivos
   */
  private async insertCode(
    request: AIGenerationRequest, 
    insertions: CodeInsertion[],
    generationId: string
  ): Promise<{ success: boolean; modifiedFiles: string[]; errors: string[] }> {
    this.logger.log(`📝 [${generationId}] Iniciando inserción real de código...`);
    this.logger.log(`📊 [${generationId}] Total de inserciones a procesar: ${insertions.length}`);
    
    const modifiedFiles: string[] = [];
    const errors: string[] = [];
    
    for (let i = 0; i < insertions.length; i++) {
      const insertion = insertions[i];
      this.logger.log(`📝 [${generationId}] Procesando inserción ${i + 1}/${insertions.length}: ${insertion.file} línea ${insertion.line}`);
      this.logger.log(`📝 [${generationId}] Tipo: ${insertion.type}, Descripción: ${insertion.description}`);
      
      try {
        this.logger.log(`🔍 [${generationId}] Verificando existencia del archivo: ${insertion.file}`);
        
        if (!fs.existsSync(insertion.file)) {
          const errorMsg = `Archivo no encontrado: ${insertion.file}`;
          errors.push(errorMsg);
          this.logger.error(`❌ [${generationId}] ${errorMsg}`);
          continue;
        }
        
        this.logger.log(`✅ [${generationId}] Archivo encontrado, leyendo contenido...`);
        
        // Leer archivo actual
        const content = fs.readFileSync(insertion.file, 'utf-8');
        const lines = content.split('\n');
        this.logger.log(`📊 [${generationId}] Archivo tiene ${lines.length} líneas`);
        
        // Insertar código en la línea especificada
        if (insertion.line > lines.length) {
          this.logger.log(`📝 [${generationId}] Línea ${insertion.line} > ${lines.length}, agregando al final del archivo`);
          lines.push(insertion.content);
        } else {
          this.logger.log(`📝 [${generationId}] Insertando en línea ${insertion.line} (índice ${insertion.line - 1})`);
          this.logger.log(`📝 [${generationId}] Contenido a insertar: ${insertion.content.substring(0, 100)}...`);
          lines.splice(insertion.line - 1, 0, insertion.content);
        }
        
        this.logger.log(`📊 [${generationId}] Archivo modificado, ahora tiene ${lines.length} líneas`);
        
        // Escribir archivo modificado
        const newContent = lines.join('\n');
        this.logger.log(`💾 [${generationId}] Escribiendo archivo modificado...`);
        fs.writeFileSync(insertion.file, newContent, 'utf-8');
        
        modifiedFiles.push(insertion.file);
        this.logger.log(`✅ [${generationId}] Insertado exitosamente en: ${insertion.file}`);
        
      } catch (error: any) {
        const errorMsg = `Error modificando ${insertion.file}: ${error.message}`;
        errors.push(errorMsg);
        this.logger.error(`❌ [${generationId}] ${errorMsg}`);
        this.logger.error(`❌ [${generationId}] Stack trace: ${error.stack}`);
      }
    }
    
    const result = {
      success: errors.length === 0,
      modifiedFiles,
      errors,
    };
    
    this.logger.log(`📊 [${generationId}] Resumen de inserción:`);
    this.logger.log(`📊 [${generationId}] - Archivos modificados: ${modifiedFiles.length}`);
    this.logger.log(`📊 [${generationId}] - Errores: ${errors.length}`);
    this.logger.log(`✅ [${generationId}] Inserción completada: ${JSON.stringify(result, null, 2)}`);
    
    return result;
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

  /**
   * Parsea el código generado por la IA
   */
  private parseGeneratedCode(generatedText: string): GeneratedCode {
    this.logger.log(`🔍 Parseando código generado...`);
    
    // TODO: Implementar parsing más sofisticado
    // Por ahora extracción básica
    
    const code: GeneratedCode = {};
    
    // Buscar código de feature (con o sin dos puntos)
    const featureMatch = generatedText.match(/```gherkin:?([\s\S]*?)```/);
    if (featureMatch) {
      code.feature = featureMatch[1].trim();
      this.logger.log(`✅ Código feature encontrado`);
    } else {
      this.logger.log(`⚠️ No se encontró código feature con formato esperado`);
    }
    
    // Buscar código de steps (con o sin dos puntos)
    const stepsMatch = generatedText.match(/```typescript:?([\s\S]*?)```/);
    if (stepsMatch) {
      code.steps = stepsMatch[1].trim();
      this.logger.log(`✅ Código steps encontrado`);
    } else {
      this.logger.log(`⚠️ No se encontró código steps con formato esperado`);
    }
    
    this.logger.log(`📋 Código parseado: ${JSON.stringify(code, null, 2)}`);
    
    return code;
  }

  /**
   * Analiza archivo feature y encuentra la ubicación para insertar
   */
  private async analyzeFeatureFile(filePath: string, newFeatureCode: string, generationId: string): Promise<CodeInsertion | null> {
    this.logger.log(`🔍 [${generationId}] Analizando archivo feature: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      this.logger.log(`⚠️ [${generationId}] Archivo feature no existe: ${filePath}`);
      return null;
    }
    
    this.logger.log(`📄 [${generationId}] Archivo feature encontrado, leyendo contenido...`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    this.logger.log(`📊 [${generationId}] Archivo feature tiene ${lines.length} líneas`);
    
    // Buscar el último escenario
    let lastScenarioLine = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().startsWith('Scenario:')) {
        lastScenarioLine = i;
        this.logger.log(`🎯 [${generationId}] Último Scenario encontrado en línea ${i + 1}: "${lines[i].trim()}"`);
        break;
      }
    }
    
    if (lastScenarioLine === -1) {
      this.logger.log(`⚠️ [${generationId}] No se encontraron escenarios en el archivo`);
    }
    
    // Si no hay escenarios, buscar después del Background o al final del archivo
    let insertLine = lines.length;
    if (lastScenarioLine >= 0) {
      // Insertar después del último escenario
      insertLine = lastScenarioLine + 1;
      this.logger.log(`📍 [${generationId}] Comenzando búsqueda desde línea ${insertLine + 1} (después del último Scenario)`);
      
      // Avanzar hasta encontrar una línea vacía o el final
      while (insertLine < lines.length && lines[insertLine].trim() !== '') {
        this.logger.log(`🔍 [${generationId}] Línea ${insertLine + 1}: "${lines[insertLine].trim()}" (no vacía, continuando...)`);
        insertLine++;
      }
      this.logger.log(`✅ [${generationId}] Encontrada línea vacía o final en línea ${insertLine + 1}`);
    } else {
      // Buscar después del Background
      this.logger.log(`🔍 [${generationId}] Buscando Background...`);
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('Background:')) {
          this.logger.log(`🎯 [${generationId}] Background encontrado en línea ${i + 1}`);
          insertLine = i + 1;
          while (insertLine < lines.length && lines[insertLine].trim() !== '') {
            this.logger.log(`🔍 [${generationId}] Línea ${insertLine + 1}: "${lines[insertLine].trim()}" (no vacía, continuando...)`);
            insertLine++;
          }
          this.logger.log(`✅ [${generationId}] Encontrada línea vacía después del Background en línea ${insertLine + 1}`);
          break;
        }
      }
    }
    
    this.logger.log(`📍 [${generationId}] LÍNEA FINAL DE INSERCIÓN: ${insertLine + 1}`);
    this.logger.log(`📍 [${generationId}] Contenido a insertar: ${newFeatureCode.substring(0, 100)}...`);
    
    return {
      file: filePath,
      line: insertLine + 1, // 1-indexed
      content: '\n' + newFeatureCode,
      type: 'scenario',
      description: 'Insertar nuevo escenario después del último existente',
    };
  }

  /**
   * Analiza archivo steps y encuentra las ubicaciones para insertar usando comentarios de sección
   */
  private async analyzeStepsFile(filePath: string, newStepsCode: string, generationId: string): Promise<CodeInsertion[]> {
    this.logger.log(`🔍 [${generationId}] Analizando archivo steps: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      this.logger.log(`⚠️ [${generationId}] Archivo steps no existe: ${filePath}`);
      return [];
    }
    
    this.logger.log(`📄 [${generationId}] Archivo steps encontrado, leyendo contenido...`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    this.logger.log(`📊 [${generationId}] Archivo steps tiene ${lines.length} líneas`);
    
    // Buscar comentarios de sección
    let whenCommentLine = -1;
    let thenCommentLine = -1;
    
    this.logger.log(`🔍 [${generationId}] Buscando comentarios de sección...`);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '// When steps') {
        whenCommentLine = i;
        this.logger.log(`🎯 [${generationId}] Comentario "// When steps" encontrado en línea ${i + 1}`);
      } else if (line === '// Then steps') {
        thenCommentLine = i;
        this.logger.log(`🎯 [${generationId}] Comentario "// Then steps" encontrado en línea ${i + 1}`);
      }
    }
    
    this.logger.log(`📊 [${generationId}] Comentarios encontrados:`);
    this.logger.log(`📊 [${generationId}] - "// When steps": línea ${whenCommentLine >= 0 ? whenCommentLine + 1 : 'NO ENCONTRADO'}`);
    this.logger.log(`📊 [${generationId}] - "// Then steps": línea ${thenCommentLine >= 0 ? thenCommentLine + 1 : 'NO ENCONTRADO'}`);
    
    const insertions: CodeInsertion[] = [];
    
    // Parsear el código de steps para separar Given, When, Then
    this.logger.log(`🔍 [${generationId}] Parseando bloques de steps...`);
    const stepBlocks = this.parseStepBlocks(newStepsCode);
    this.logger.log(`📊 [${generationId}] Bloques encontrados:`);
    this.logger.log(`📊 [${generationId}] - Given: ${stepBlocks.given ? 'SÍ' : 'NO'}`);
    this.logger.log(`📊 [${generationId}] - When: ${stepBlocks.when ? 'SÍ' : 'NO'}`);
    this.logger.log(`📊 [${generationId}] - Then: ${stepBlocks.then ? 'SÍ' : 'NO'}`);
    
    // Insertar cada bloque en su ubicación correspondiente usando comentarios
    if (stepBlocks.given && whenCommentLine >= 0) {
      this.logger.log(`🔍 [${generationId}] Procesando inserción de Given...`);
      this.logger.log(`📍 [${generationId}] Insertando Given antes del comentario "// When steps" en línea ${whenCommentLine + 1}`);
      insertions.push({
        file: filePath,
        line: whenCommentLine + 1,
        content: '\n' + stepBlocks.given,
        type: 'step',
        description: 'Insertar nuevo Given antes del comentario "// When steps"',
      });
    }
    
    if (stepBlocks.when && thenCommentLine >= 0) {
      this.logger.log(`🔍 [${generationId}] Procesando inserción de When...`);
      this.logger.log(`📍 [${generationId}] Insertando When antes del comentario "// Then steps" en línea ${thenCommentLine + 1}`);
      insertions.push({
        file: filePath,
        line: thenCommentLine + 1,
        content: '\n' + stepBlocks.when,
        type: 'step',
        description: 'Insertar nuevo When antes del comentario "// Then steps"',
      });
    }
    
    if (stepBlocks.then) {
      this.logger.log(`🔍 [${generationId}] Procesando inserción de Then...`);
      this.logger.log(`📍 [${generationId}] Insertando Then al final del archivo en línea ${lines.length + 1}`);
      insertions.push({
        file: filePath,
        line: lines.length + 1,
        content: '\n' + stepBlocks.then,
        type: 'step',
        description: 'Insertar nuevo Then al final del archivo',
      });
    }
    
    this.logger.log(`📊 [${generationId}] Total de inserciones de steps: ${insertions.length}`);
    for (let i = 0; i < insertions.length; i++) {
      this.logger.log(`📝 [${generationId}] Inserción ${i + 1}: línea ${insertions[i].line} - ${insertions[i].description}`);
    }
    
    return insertions;
  }

  /**
   * Encuentra el final de un bloque de step
   */
  private findEndOfStepBlock(lines: string[], startLine: number): number {
    let endLine = startLine;
    
    // Avanzar hasta encontrar el final de la función
    while (endLine < lines.length) {
      const line = lines[endLine].trim();
      
      // Si encontramos otro step o el final del archivo
      if ((line.startsWith("Given('") || line.startsWith('Given(') ||
           line.startsWith("When('") || line.startsWith('When(') ||
           line.startsWith("Then('") || line.startsWith('Then(')) && 
          endLine !== startLine) {
        break;
      }
      
      endLine++;
    }
    
    return endLine;
  }

  /**
   * Parsea bloques de steps (Given, When, Then) y remueve imports innecesarios
   */
  private parseStepBlocks(stepsCode: string): { given?: string; when?: string; then?: string } {
    const blocks: { given?: string; when?: string; then?: string } = {};
    const lines = stepsCode.split('\n');
    
    let currentBlock: string | null = null;
    let currentContent: string[] = [];
    
    for (const line of lines) {
      // Saltar líneas de import y comentarios de archivo
      if (line.trim().startsWith('import ') || 
          line.trim().startsWith('// steps/') || 
          line.trim().startsWith('// features/')) {
        continue;
      }
      
      if (line.trim().startsWith('Given(')) {
        if (currentBlock && currentContent.length > 0) {
          blocks[currentBlock as keyof typeof blocks] = currentContent.join('\n');
        }
        currentBlock = 'given';
        currentContent = [line];
      } else if (line.trim().startsWith('When(')) {
        if (currentBlock && currentContent.length > 0) {
          blocks[currentBlock as keyof typeof blocks] = currentContent.join('\n');
        }
        currentBlock = 'when';
        currentContent = [line];
      } else if (line.trim().startsWith('Then(')) {
        if (currentBlock && currentContent.length > 0) {
          blocks[currentBlock as keyof typeof blocks] = currentContent.join('\n');
        }
        currentBlock = 'then';
        currentContent = [line];
      } else if (currentBlock) {
        currentContent.push(line);
      }
    }
    
    // Agregar el último bloque
    if (currentBlock && currentContent.length > 0) {
      blocks[currentBlock as keyof typeof blocks] = currentContent.join('\n');
    }
    
    return blocks;
  }
} 