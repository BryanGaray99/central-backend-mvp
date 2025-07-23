import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import { AIAssistant } from '../entities/ai-assistant.entity';
import { Project } from '../../projects/project.entity';
import { ThreadManagerService } from './thread-manager.service';

@Injectable()
export class AssistantManagerService {
  private readonly logger = new Logger(AssistantManagerService.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(AIAssistant)
    private readonly aiAssistantRepository: Repository<AIAssistant>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly threadManagerService: ThreadManagerService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  /**
   * Obtiene un assistant existente para un proyecto
   */
  async getAssistant(projectId: string): Promise<AIAssistant | null> {
    this.logger.log(`🔍 Buscando assistant para proyecto ${projectId}`);

    // Buscar assistant existente
    const assistant = await this.aiAssistantRepository.findOne({
      where: { projectId },
      relations: ['project'],
    });

    if (!assistant) {
      this.logger.log(`❌ No se encontró assistant para proyecto ${projectId}`);
      return null;
    }

    this.logger.log(`✅ Assistant encontrado en BD: ${assistant.assistantId}`);
    
    // Verificar que el assistant sigue activo en OpenAI
    try {
      await this.openai.beta.assistants.retrieve(assistant.assistantId);
      this.logger.log(`✅ Assistant verificado en OpenAI`);
      return assistant;
    } catch (error) {
      this.logger.warn(`⚠️ Assistant no encontrado en OpenAI, eliminando de BD...`);
      // Si no existe en OpenAI, lo eliminamos de la BD
      await this.aiAssistantRepository.remove(assistant);
      return null;
    }
  }

  /**
   * Crea un nuevo assistant para un proyecto
   */
  async createAssistant(projectId: string): Promise<AIAssistant> {
    this.logger.log(`🚀 Creando nuevo assistant para proyecto ${projectId}`);
    
    // Verificar que no existe ya un assistant
    const existingAssistant = await this.getAssistant(projectId);
    if (existingAssistant) {
      throw new Error(`Ya existe un assistant para el proyecto ${projectId}. Usa getAssistant() para obtenerlo.`);
    }

    return await this.createAssistantInternal(projectId);
  }

  /**
   * Crea un nuevo assistant para un proyecto (método interno)
   */
  private async createAssistantInternal(projectId: string): Promise<AIAssistant> {
    // Obtener información del proyecto
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`);
    }

    // Crear assistant en OpenAI (sin vector store)
    const openaiAssistant = await this.openai.beta.assistants.create({
      name: `API-Test-Bot-${project.name}`,
      instructions: this.buildAssistantInstructions(project),
      model: 'gpt-4o-mini',
      tools: [], // Sin tools, los archivos se enviarán en el prompt
    });
    this.logger.log(`✅ Assistant creado en OpenAI: ${openaiAssistant.id}`);

    // Guardar assistant en BD
    const assistant = new AIAssistant();
    assistant.projectId = projectId;
    assistant.assistantId = openaiAssistant.id;
    assistant.instructions = openaiAssistant.instructions || '';
    assistant.tools = JSON.stringify(openaiAssistant.tools);
    assistant.model = openaiAssistant.model;
    assistant.status = 'active';

    const savedAssistant = await this.aiAssistantRepository.save(assistant);
    this.logger.log(`💾 Assistant guardado en BD: ${savedAssistant.id}`);

    // Actualizar proyecto con assistant_id
    await this.projectRepository.update(projectId, {
      assistantId: openaiAssistant.id,
      assistantCreatedAt: new Date(),
    });

    this.logger.log(`📝 Proyecto actualizado con assistant_id`);

    return savedAssistant;
  }

  /**
   * Construye las instrucciones del assistant basadas en el proyecto
   */
  private buildAssistantInstructions(project: Project): string {
    return `Eres un asistente especializado en generar tests de APIs REST con Playwright y BDD para ${project.name}.

INSTRUCCIONES PRINCIPALES:
1. **ANÁLISIS DE CONTEXTO**: Los archivos feature y steps actuales se incluyen directamente en el prompt
2. **GENERACIÓN INTELIGENTE**: Analiza los archivos existentes para evitar duplicaciones
3. **FORMATO CONSISTENTE**: Mantén el estilo y estructura de los archivos existentes
4. **RESPUESTA ESTRUCTURADA**: Usa el formato específico solicitado en el prompt

REGLAS ESTRICTAS:
1. SOLO APIs REST
2. NO dupliques steps ni escenarios existentes
3. Respeta secciones: Given antes de "// When steps", When antes de "// Then steps"
4. Agrega ID incremental: @TC-${project.name}-{entityName}-Number
5. Usa clientes API existentes (ProductClient, etc.)
6. NO incluyas "Feature:" ni rutas en la respuesta
7. Genera SOLO el código necesario para completar la operación
8. Sigue EXACTAMENTE el formato de respuesta especificado en el prompt

CONTEXTO: Los archivos actuales se proporcionan en el prompt para que puedas analizarlos y generar contenido complementario. El prompt te dará instrucciones específicas sobre el formato de respuesta requerido.`;
  }

  /**
   * Verifica que el assistant tenga acceso
   */
  async verifyAssistantAccess(projectId: string): Promise<boolean> {
    const assistant = await this.aiAssistantRepository.findOne({
      where: { projectId },
    });

    if (!assistant) {
      return false;
    }

    try {
      // Verificar que el assistant existe en OpenAI
      await this.openai.beta.assistants.retrieve(assistant.assistantId);
      return true;
    } catch (error) {
      this.logger.warn(`⚠️ Error verificando acceso del assistant: ${error.message}`);
      return false;
    }
  }

  /**
   * Elimina un assistant
   */
  async deleteAssistant(projectId: string): Promise<void> {
    const assistant = await this.aiAssistantRepository.findOne({
      where: { projectId },
    });

    if (assistant) {
      try {
        this.logger.log(`🗑️ [DELETE] Iniciando eliminación de assistant: ${assistant.assistantId}`);
        
        // 1. ELIMINAR THREADS PRIMERO (para evitar foreign key constraint)
        this.logger.log(`🗑️ [DELETE] Paso 1: Eliminando threads...`);
        try {
          await this.threadManagerService.deleteAllProjectThreads(projectId);
          this.logger.log(`✅ [DELETE] Threads eliminados exitosamente para proyecto: ${projectId}`);
        } catch (err) {
          this.logger.error(`❌ [DELETE] Error eliminando threads: ${err.message}`);
          // Continuar con la eliminación aunque falle
        }

        // 2. LIMPIAR REFERENCIA EN PROYECTO (antes de eliminar assistant)
        this.logger.log(`🗑️ [DELETE] Paso 2: Limpiando referencia en proyecto...`);
        try {
          await this.projectRepository.update(projectId, {
            assistantId: undefined,
            assistantCreatedAt: undefined,
          });
          this.logger.log(`✅ [DELETE] Referencia de assistant limpiada en proyecto: ${projectId}`);
        } catch (err) {
          this.logger.error(`❌ [DELETE] Error limpiando referencia en proyecto: ${err.message}`);
        }

        // 3. ELIMINAR DE OPENAI
        this.logger.log(`🗑️ [DELETE] Paso 3: Eliminando de OpenAI...`);
        try {
          await this.openai.beta.assistants.del(assistant.assistantId);
          this.logger.log(`✅ [DELETE] Assistant eliminado de OpenAI: ${assistant.assistantId}`);
        } catch (err) {
          this.logger.error(`❌ [DELETE] Error eliminando assistant de OpenAI: ${err.message}`);
        }

        // 4. ELIMINAR ASSISTANT DE BD (último paso)
        this.logger.log(`🗑️ [DELETE] Paso 4: Eliminando assistant de BD...`);
        try {
          await this.aiAssistantRepository.remove(assistant);
          this.logger.log(`✅ [DELETE] Assistant eliminado de BD exitosamente`);
        } catch (err) {
          this.logger.error(`❌ [DELETE] Error eliminando assistant de BD: ${err.message}`);
          throw err; // Re-lanzar para que el usuario sepa que falló
        }
        
        this.logger.log(`🎉 [DELETE] Eliminación de assistant completada exitosamente`);
        
      } catch (error) {
        this.logger.error(`💥 [DELETE] Error general en eliminación: ${error.message}`);
        throw error;
      }
    } else {
      this.logger.warn(`⚠️ [DELETE] No se encontró assistant para eliminar en proyecto: ${projectId}`);
    }
  }
} 