import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { 
  AIGenerationRequest, 
  GeneratedCode, 
  CodeInsertion 
} from '../../../modules/ai/interfaces/ai-agent.interface';
import { Project } from '../../../modules/projects/project.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { StepFilesManipulationService, FeatureFilesManipulationService } from './index';

@Injectable()
export class TestCaseAnalysisService {
  private readonly logger = new Logger(TestCaseAnalysisService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly stepFilesManipulationService: StepFilesManipulationService,
    private readonly featureFilesManipulationService: FeatureFilesManipulationService,
  ) {}

  /**
   * Analiza archivos existentes y determina las inserciones necesarias para test cases
   */
  async analyzeAndDetermineInsertions(
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
      const featureInsertion = await this.analyzeFeatureInsertion(project, request, newCode.feature, generationId);
      if (featureInsertion) {
        insertions.push(featureInsertion);
      }
    } else {
      this.logger.log(`⚠️ [${generationId}] No hay código feature para analizar`);
    }
    
    // Analizar archivo steps
    if (newCode.steps) {
      const stepsInsertions = await this.analyzeStepsInsertion(project, request, newCode.steps, generationId);
      insertions.push(...stepsInsertions);
    } else {
      this.logger.log(`⚠️ [${generationId}] No hay código steps para analizar`);
    }
    
    // Analizar otros tipos de archivos si es necesario
    if (newCode.fixtures) {
      const fixturesInsertion = await this.analyzeFixturesInsertion(project, request, newCode.fixtures, generationId);
      if (fixturesInsertion) {
        insertions.push(fixturesInsertion);
      }
    }
    
    if (newCode.schemas) {
      const schemasInsertion = await this.analyzeSchemasInsertion(project, request, newCode.schemas, generationId);
      if (schemasInsertion) {
        insertions.push(schemasInsertion);
      }
    }
    
    if (newCode.types) {
      const typesInsertion = await this.analyzeTypesInsertion(project, request, newCode.types, generationId);
      if (typesInsertion) {
        insertions.push(typesInsertion);
      }
    }
    
    if (newCode.client) {
      const clientInsertion = await this.analyzeClientInsertion(project, request, newCode.client, generationId);
      if (clientInsertion) {
        insertions.push(clientInsertion);
      }
    }
    
    this.logger.log(`📊 [${generationId}] Total de inserciones determinadas: ${insertions.length}`);
    this.logger.log(`✅ [${generationId}] Inserciones determinadas: ${JSON.stringify(insertions, null, 2)}`);
    
    return insertions;
  }

  /**
   * Analiza la inserción para archivo feature
   */
  private async analyzeFeatureInsertion(
    project: Project,
    request: AIGenerationRequest,
    featureCode: string,
    generationId: string
  ): Promise<CodeInsertion | null> {
    this.logger.log(`🔍 [${generationId}] Analizando archivo feature...`);
    const featurePath = path.join(project.path, `src/features/${request.section}/${request.entityName.toLowerCase()}.feature`);
    this.logger.log(`📄 [${generationId}] Ruta del archivo feature: ${featurePath}`);
    this.logger.log(`📄 [${generationId}] ¿Existe el archivo feature? ${fs.existsSync(featurePath)}`);
    
    return await this.featureFilesManipulationService.analyzeFeatureFile(featurePath, featureCode, generationId);
  }

  /**
   * Analiza la inserción para archivo steps
   */
  private async analyzeStepsInsertion(
    project: Project,
    request: AIGenerationRequest,
    stepsCode: string,
    generationId: string
  ): Promise<CodeInsertion[]> {
    this.logger.log(`🔍 [${generationId}] Analizando archivo steps...`);
    const stepsPath = path.join(project.path, `src/steps/${request.section}/${request.entityName.toLowerCase()}.steps.ts`);
    this.logger.log(`📄 [${generationId}] Ruta del archivo steps: ${stepsPath}`);
    this.logger.log(`📄 [${generationId}] ¿Existe el archivo steps? ${fs.existsSync(stepsPath)}`);
    
    return await this.stepFilesManipulationService.analyzeStepsFile(stepsPath, stepsCode, generationId);
  }

  /**
   * Analiza la inserción para archivo fixtures
   */
  private async analyzeFixturesInsertion(
    project: Project,
    request: AIGenerationRequest,
    fixturesCode: string,
    generationId: string
  ): Promise<CodeInsertion | null> {
    this.logger.log(`🔍 [${generationId}] Analizando archivo fixtures...`);
    const fixturesPath = path.join(project.path, `src/fixtures/${request.section}/${request.entityName.toLowerCase()}.fixture.ts`);
    this.logger.log(`📄 [${generationId}] Ruta del archivo fixtures: ${fixturesPath}`);
    
    // TODO: Implementar lógica específica para fixtures
    this.logger.log(`⚠️ [${generationId}] Análisis de fixtures no implementado aún`);
    return null;
  }

  /**
   * Analiza la inserción para archivo schemas
   */
  private async analyzeSchemasInsertion(
    project: Project,
    request: AIGenerationRequest,
    schemasCode: string,
    generationId: string
  ): Promise<CodeInsertion | null> {
    this.logger.log(`🔍 [${generationId}] Analizando archivo schemas...`);
    const schemasPath = path.join(project.path, `src/schemas/${request.section}/${request.entityName.toLowerCase()}.schema.ts`);
    this.logger.log(`📄 [${generationId}] Ruta del archivo schemas: ${schemasPath}`);
    
    // TODO: Implementar lógica específica para schemas
    this.logger.log(`⚠️ [${generationId}] Análisis de schemas no implementado aún`);
    return null;
  }

  /**
   * Analiza la inserción para archivo types
   */
  private async analyzeTypesInsertion(
    project: Project,
    request: AIGenerationRequest,
    typesCode: string,
    generationId: string
  ): Promise<CodeInsertion | null> {
    this.logger.log(`🔍 [${generationId}] Analizando archivo types...`);
    const typesPath = path.join(project.path, `src/types/${request.section}/${request.entityName.toLowerCase()}.ts`);
    this.logger.log(`📄 [${generationId}] Ruta del archivo types: ${typesPath}`);
    
    // TODO: Implementar lógica específica para types
    this.logger.log(`⚠️ [${generationId}] Análisis de types no implementado aún`);
    return null;
  }

  /**
   * Analiza la inserción para archivo client
   */
  private async analyzeClientInsertion(
    project: Project,
    request: AIGenerationRequest,
    clientCode: string,
    generationId: string
  ): Promise<CodeInsertion | null> {
    this.logger.log(`🔍 [${generationId}] Analizando archivo client...`);
    const clientPath = path.join(project.path, `src/api/${request.section}/${request.entityName.toLowerCase()}Client.ts`);
    this.logger.log(`📄 [${generationId}] Ruta del archivo client: ${clientPath}`);
    
    // TODO: Implementar lógica específica para client
    this.logger.log(`⚠️ [${generationId}] Análisis de client no implementado aún`);
    return null;
  }

  /**
   * Valida que el proyecto tenga la estructura necesaria para las inserciones
   */
  validateProjectStructure(project: Project, request: AIGenerationRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Verificar que existan las carpetas necesarias
    const requiredDirs = [
      path.join(project.path, 'src/features', request.section),
      path.join(project.path, 'src/steps', request.section),
      path.join(project.path, 'src/fixtures', request.section),
      path.join(project.path, 'src/schemas', request.section),
      path.join(project.path, 'src/types', request.section),
      path.join(project.path, 'src/api', request.section),
    ];
    
    for (const dir of requiredDirs) {
      if (!fs.existsSync(dir)) {
        errors.push(`Directorio no encontrado: ${dir}`);
      }
    }
    
    return { isValid: errors.length === 0, errors };
  }

  /**
   * Obtiene estadísticas de los archivos que se van a modificar
   */
  getModificationStats(project: Project, request: AIGenerationRequest): {
    featureExists: boolean;
    stepsExists: boolean;
    fixturesExists: boolean;
    schemasExists: boolean;
    typesExists: boolean;
    clientExists: boolean;
  } {
    const basePath = project.path;
    const section = request.section;
    const entityName = request.entityName.toLowerCase();
    
    return {
      featureExists: fs.existsSync(path.join(basePath, `src/features/${section}/${entityName}.feature`)),
      stepsExists: fs.existsSync(path.join(basePath, `src/steps/${section}/${entityName}.steps.ts`)),
      fixturesExists: fs.existsSync(path.join(basePath, `src/fixtures/${section}/${entityName}.fixture.ts`)),
      schemasExists: fs.existsSync(path.join(basePath, `src/schemas/${section}/${entityName}.schema.ts`)),
      typesExists: fs.existsSync(path.join(basePath, `src/types/${section}/${entityName}.ts`)),
      clientExists: fs.existsSync(path.join(basePath, `src/api/${section}/${entityName}Client.ts`)),
    };
  }
} 