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

/**
 * Test Case Analysis Service
 * 
 * Analyzes existing project files and determines the necessary insertions for test cases.
 * Provides functionality to analyze feature files, step files, and other project artifacts
 * to determine optimal insertion points for AI-generated test code.
 * 
 * @class TestCaseAnalysisService
 */
@Injectable()
export class TestCaseAnalysisService {
  private readonly logger = new Logger(TestCaseAnalysisService.name);

  /**
   * Creates an instance of TestCaseAnalysisService.
   * 
   * @param projectRepository - Repository for project entities
   * @param stepFilesManipulationService - Service for step file manipulation
   * @param featureFilesManipulationService - Service for feature file manipulation
   */
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly stepFilesManipulationService: StepFilesManipulationService,
    private readonly featureFilesManipulationService: FeatureFilesManipulationService,
  ) {}

  /**
   * Analyzes existing files and determines the necessary insertions for test cases.
   * 
   * @param request - AI generation request containing project and entity information
   * @param newCode - Generated code to be inserted
   * @param generationId - Unique identifier for the generation process
   * @returns Promise with array of code insertions
   * 
   * @example
   * ```typescript
   * const insertions = await analysisService.analyzeAndDetermineInsertions(
   *   request,
   *   generatedCode,
   *   'gen-123'
   * );
   * console.log(`Found ${insertions.length} insertion points`);
   * ```
   */
  async analyzeAndDetermineInsertions(
    request: AIGenerationRequest, 
    newCode: GeneratedCode,
    generationId: string
  ): Promise<CodeInsertion[]> {
    this.logger.log(`🔍 [${generationId}] Analyzing existing files...`);
    
    // Get project to use its path
    const project = await this.projectRepository.findOneBy({ id: request.projectId });
    if (!project) {
      throw new Error(`Project with ID ${request.projectId} not found`);
    }
    
    this.logger.log(`📁 [${generationId}] Project found: ${project.name}`);
    this.logger.log(`📁 [${generationId}] Project path: ${project.path}`);
    
    const insertions: CodeInsertion[] = [];
    
    // Analyze feature file
    if (newCode.feature) {
      const featureInsertion = await this.analyzeFeatureInsertion(project, request, newCode.feature, generationId);
      if (featureInsertion) {
        insertions.push(featureInsertion);
      }
    } else {
      this.logger.log(`⚠️ [${generationId}] No feature code to analyze`);
    }
    
    // Analyze step file
    if (newCode.steps) {
      const stepsInsertions = await this.analyzeStepsInsertion(project, request, newCode.steps, generationId);
      insertions.push(...stepsInsertions);
    } else {
      this.logger.log(`⚠️ [${generationId}] No steps code to analyze`);
    }
    
    // Analyze other types of files if necessary
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
    
    this.logger.log(`📊 [${generationId}] Total insertions determined: ${insertions.length}`);
    this.logger.log(`✅ [${generationId}] Insertions determined: ${JSON.stringify(insertions, null, 2)}`);
    
    return insertions;
  }

  /**
   * Analyzes insertion for feature file.
   * 
   * @private
   * @param project - Project entity containing path information
   * @param request - AI generation request
   * @param featureCode - Feature code to insert
   * @param generationId - Unique identifier for the generation process
   * @returns Promise with code insertion for feature file or null
   */
  private async analyzeFeatureInsertion(
    project: Project,
    request: AIGenerationRequest,
    featureCode: string,
    generationId: string
  ): Promise<CodeInsertion | null> {
    this.logger.log(`🔍 [${generationId}] Analyzing feature file...`);
    const featurePath = path.join(project.path, `src/features/${request.section}/${request.entityName.toLowerCase()}.feature`);
    this.logger.log(`📄 [${generationId}] Feature file path: ${featurePath}`);
    this.logger.log(`📄 [${generationId}] Does feature file exist? ${fs.existsSync(featurePath)}`);
    
    return await this.featureFilesManipulationService.analyzeFeatureFile(featurePath, featureCode, generationId);
  }

  /**
   * Analyzes insertion for step file.
   * 
   * @private
   * @param project - Project entity containing path information
   * @param request - AI generation request
   * @param stepsCode - Steps code to insert
   * @param generationId - Unique identifier for the generation process
   * @returns Promise with array of code insertions for step file
   */
  private async analyzeStepsInsertion(
    project: Project,
    request: AIGenerationRequest,
    stepsCode: string,
    generationId: string
  ): Promise<CodeInsertion[]> {
    this.logger.log(`🔍 [${generationId}] Analyzing step file...`);
    const stepsPath = path.join(project.path, `src/steps/${request.section}/${request.entityName.toLowerCase()}.steps.ts`);
    this.logger.log(`📄 [${generationId}] Step file path: ${stepsPath}`);
    this.logger.log(`📄 [${generationId}] Does step file exist? ${fs.existsSync(stepsPath)}`);
    
    return await this.stepFilesManipulationService.analyzeStepsFile(stepsPath, stepsCode, generationId);
  }

  /**
   * Analyzes insertion for fixtures file.
   * 
   * @private
   * @param project - Project entity containing path information
   * @param request - AI generation request
   * @param fixturesCode - Fixtures code to insert
   * @param generationId - Unique identifier for the generation process
   * @returns Promise with code insertion for fixtures file or null
   */
  private async analyzeFixturesInsertion(
    project: Project,
    request: AIGenerationRequest,
    fixturesCode: string,
    generationId: string
  ): Promise<CodeInsertion | null> {
    this.logger.log(`🔍 [${generationId}] Analyzing fixtures file...`);
    const fixturesPath = path.join(project.path, `src/fixtures/${request.section}/${request.entityName.toLowerCase()}.fixture.ts`);
    this.logger.log(`📄 [${generationId}] Fixtures file path: ${fixturesPath}`);
    
    // TODO: Implement specific logic for fixtures
    this.logger.log(`⚠️ [${generationId}] Fixtures analysis not implemented yet`);
    return null;
  }

  /**
   * Analyzes insertion for schemas file.
   * 
   * @private
   * @param project - Project entity containing path information
   * @param request - AI generation request
   * @param schemasCode - Schemas code to insert
   * @param generationId - Unique identifier for the generation process
   * @returns Promise with code insertion for schemas file or null
   */
  private async analyzeSchemasInsertion(
    project: Project,
    request: AIGenerationRequest,
    schemasCode: string,
    generationId: string
  ): Promise<CodeInsertion | null> {
    this.logger.log(`🔍 [${generationId}] Analyzing schemas file...`);
    const schemasPath = path.join(project.path, `src/schemas/${request.section}/${request.entityName.toLowerCase()}.schema.ts`);
    this.logger.log(`📄 [${generationId}] Schemas file path: ${schemasPath}`);
    
    // TODO: Implement specific logic for schemas
    this.logger.log(`⚠️ [${generationId}] Schemas analysis not implemented yet`);
    return null;
  }

  /**
   * Analyzes insertion for types file.
   * 
   * @private
   * @param project - Project entity containing path information
   * @param request - AI generation request
   * @param typesCode - Types code to insert
   * @param generationId - Unique identifier for the generation process
   * @returns Promise with code insertion for types file or null
   */
  private async analyzeTypesInsertion(
    project: Project,
    request: AIGenerationRequest,
    typesCode: string,
    generationId: string
  ): Promise<CodeInsertion | null> {
    this.logger.log(`🔍 [${generationId}] Analyzing types file...`);
    const typesPath = path.join(project.path, `src/types/${request.section}/${request.entityName.toLowerCase()}.ts`);
    this.logger.log(`📄 [${generationId}] Types file path: ${typesPath}`);
    
    // TODO: Implement specific logic for types
    this.logger.log(`⚠️ [${generationId}] Types analysis not implemented yet`);
    return null;
  }

  /**
   * Analyzes insertion for client file.
   * 
   * @private
   * @param project - Project entity containing path information
   * @param request - AI generation request
   * @param clientCode - Client code to insert
   * @param generationId - Unique identifier for the generation process
   * @returns Promise with code insertion for client file or null
   */
  private async analyzeClientInsertion(
    project: Project,
    request: AIGenerationRequest,
    clientCode: string,
    generationId: string
  ): Promise<CodeInsertion | null> {
    this.logger.log(`🔍 [${generationId}] Analyzing client file...`);
    const clientPath = path.join(project.path, `src/api/${request.section}/${request.entityName.toLowerCase()}Client.ts`);
    this.logger.log(`📄 [${generationId}] Client file path: ${clientPath}`);
    
    // TODO: Implement specific logic for client
    this.logger.log(`⚠️ [${generationId}] Client analysis not implemented yet`);
    return null;
  }

  /**
   * Validates that the project has the necessary structure for insertions.
   * 
   * @param project - Project entity to validate
   * @param request - AI generation request containing section information
   * @returns Validation result with success status and error messages
   * 
   * @example
   * ```typescript
   * const validation = analysisService.validateProjectStructure(project, request);
   * if (!validation.isValid) {
   *   console.log('Structure errors:', validation.errors);
   * }
   * ```
   */
  validateProjectStructure(project: Project, request: AIGenerationRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Verify that necessary directories exist
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
        errors.push(`Directory not found: ${dir}`);
      }
    }
    
    return { isValid: errors.length === 0, errors };
  }

  /**
   * Gets statistics of files that will be modified.
   * 
   * @param project - Project entity containing path information
   * @param request - AI generation request containing section and entity information
   * @returns Object with boolean flags indicating which files exist
   * 
   * @example
   * ```typescript
   * const stats = analysisService.getModificationStats(project, request);
   * console.log(`Feature exists: ${stats.featureExists}`);
   * console.log(`Steps exist: ${stats.stepsExists}`);
   * ```
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