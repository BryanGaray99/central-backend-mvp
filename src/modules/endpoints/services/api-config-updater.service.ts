import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Endpoint } from '../endpoint.entity';
import { Project } from '../../projects/project.entity';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';

@Injectable()
export class ApiConfigUpdaterService {
  private readonly logger = new Logger(ApiConfigUpdaterService.name);

  constructor(
    @InjectRepository(Endpoint)
    private readonly endpointRepository: Repository<Endpoint>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  /**
   * Actualiza el archivo api.config.ts del proyecto con todos los endpoints registrados
   */
  async updateApiConfig(projectId: string): Promise<void> {
    try {
      this.logger.log(`Actualizando api.config.ts para el proyecto ${projectId}`);

      // Obtener el proyecto
      const project = await this.projectRepository.findOne({
        where: { id: projectId },
      });

      if (!project) {
        this.logger.warn(`Proyecto ${projectId} no encontrado`);
        return;
      }

      // Obtener todos los endpoints del proyecto
      const endpoints = await this.endpointRepository.find({
        where: { projectId },
        order: { entityName: 'ASC' },
      });

      if (endpoints.length === 0) {
        this.logger.warn(`No hay endpoints registrados para el proyecto ${projectId}`);
        return;
      }

      // Preparar datos para el template
      const templateData = this.prepareTemplateData(project, endpoints);

      // Generar el contenido del archivo
      const apiConfigContent = await this.generateApiConfigContent(templateData);

      // Escribir el archivo en la raíz del workspace del proyecto
      const apiConfigPath = path.join(project.path, 'api.config.ts');

      // Asegurar que el directorio existe
      const apiConfigDir = path.dirname(apiConfigPath);
      if (!fs.existsSync(apiConfigDir)) {
        fs.mkdirSync(apiConfigDir, { recursive: true });
      }

      // Escribir el archivo
      fs.writeFileSync(apiConfigPath, apiConfigContent, 'utf8');

      this.logger.log(`api.config.ts actualizado exitosamente en ${apiConfigPath}`);
    } catch (error) {
      this.logger.error(`Error actualizando api.config.ts: ${error.message}`, error.stack);
      // No lanzar el error para evitar que falle todo el proceso
    }
  }

  /**
   * Prepara los datos para el template de api.config.ts
   */
  private prepareTemplateData(project: Project, endpoints: Endpoint[]): any {
    const endpointsData = endpoints.map(endpoint => {
      const entityName = endpoint.entityName;
      const entityLower = entityName.toLowerCase();
      const EntityName = entityName.charAt(0).toUpperCase() + entityName.slice(1);

      // Extraer campos de creación y actualización del análisis
      const analysis = endpoint.analysisResults;
      
      // Verificar si el análisis existe y tiene la estructura esperada
      if (!analysis || typeof analysis !== 'object') {
        return {
          entityName,
          entityLower,
          EntityName,
          endpointPath: endpoint.path,
          createFields: [],
          updateFields: [],
        };
      }
      
      const createFields = this.extractCreateFields(analysis, entityName);
      const updateFields = this.extractUpdateFields(analysis, entityName);

      return {
        entityName,
        entityLower,
        EntityName,
        endpointPath: endpoint.path,
        createFields,
        updateFields,
      };
    });

    // Detectar características especiales
    const hasAddress = endpoints.some(endpoint => {
      const analysis = endpoint.analysisResults;
      if (!analysis || typeof analysis !== 'object') return false;
      return analysis?.POST?.inferredResponseSchema?.properties?.data?.properties?.address ||
             analysis?.GET?.inferredResponseSchema?.properties?.data?.properties?.address;
    });

    const hasOrderStatus = endpoints.some(endpoint => {
      const analysis = endpoint.analysisResults;
      if (!analysis || typeof analysis !== 'object') return false;
      return endpoint.entityName.toLowerCase().includes('order') ||
             analysis?.POST?.inferredResponseSchema?.properties?.data?.properties?.status ||
             analysis?.GET?.inferredResponseSchema?.properties?.data?.properties?.status;
    });

    const result = {
      baseUrl: project.baseUrl,
      basePath: project.basePath || '/v1/api',
      endpoints: endpointsData,
      hasAddress,
      hasOrderStatus,
    };

    return result;
  }

  /**
   * Extrae los campos de creación del análisis del endpoint
   */
  private extractCreateFields(analysis: any, entityName: string): any[] {
    if (!analysis?.POST?.requestBodyDefinition) {
      return [];
    }

    return analysis.POST.requestBodyDefinition.map((field: any) => ({
      name: field.name,
      type: this.mapTypeToTs(field.type),
    }));
  }

  /**
   * Extrae los campos de actualización del análisis del endpoint
   */
  private extractUpdateFields(analysis: any, entityName: string): any[] {
    const patchAnalysis = analysis?.PATCH;
    const putAnalysis = analysis?.PUT;
    const updateAnalysis = patchAnalysis || putAnalysis;

    if (!updateAnalysis?.requestBodyDefinition) {
      return [];
    }

    return updateAnalysis.requestBodyDefinition.map((field: any) => ({
      name: field.name,
      type: this.mapTypeToTs(field.type),
    }));
  }

  /**
   * Mapea tipos JSON a TypeScript
   */
  private mapTypeToTs(jsonType: string): string {
    switch (jsonType) {
      case 'string': return 'string';
      case 'number': return 'number';
      case 'integer': return 'number';
      case 'boolean': return 'boolean';
      case 'array': return 'any[]';
      case 'object': return 'Record<string, any>';
      default: return 'any';
    }
  }

  /**
   * Genera el contenido del archivo api.config.ts usando el template
   */
  private async generateApiConfigContent(templateData: any): Promise<string> {
    try {
      // Leer el template
      const templatePath = path.join(__dirname, '..', 'templates', 'api.config.ts.template');
      const templateContent = fs.readFileSync(templatePath, 'utf8');

      // Compilar el template
      const template = handlebars.compile(templateContent);

      // Generar el contenido
      return template(templateData);
    } catch (error) {
      this.logger.error(`Error generando contenido de api.config.ts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Actualiza el api.config.ts cuando se registra un nuevo endpoint
   */
  async updateApiConfigOnEndpointRegistration(projectId: string): Promise<void> {
    await this.updateApiConfig(projectId);
  }

  /**
   * Actualiza el api.config.ts cuando se elimina un endpoint
   */
  async updateApiConfigOnEndpointDeletion(projectId: string): Promise<void> {
    await this.updateApiConfig(projectId);
  }
} 