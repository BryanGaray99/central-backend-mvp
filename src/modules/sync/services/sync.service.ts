import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Project } from '../../projects/project.entity';
import { Endpoint } from '../../endpoints/endpoint.entity';
import { TestCase, TestCaseStatus, TestType } from '../../test-cases/entities/test-case.entity';
import { TestStep } from '../../test-cases/entities/test-step.entity';
import { TestStepRegistrationService } from '../../test-cases/services/test-step-registration.service';
import { TestCaseRegistrationService } from '../../test-cases/services/test-case-registration.service';

/**
 * Sync Service
 * 
 * Comprehensive service for project synchronization between file system artifacts
 * and database entities. Handles synchronization of endpoints, test cases, and
 * test steps to maintain consistency between generated files and database records.
 * Provides intelligent detection of existing test cases and artifact management.
 * 
 * @service SyncService
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Endpoint)
    private readonly endpointRepository: Repository<Endpoint>,
    @InjectRepository(TestCase)
    private readonly testCaseRepository: Repository<TestCase>,
    @InjectRepository(TestStep)
    private readonly testStepRepository: Repository<TestStep>,
    private readonly testStepRegistrationService: TestStepRegistrationService,
    private readonly testCaseRegistrationService: TestCaseRegistrationService,
  ) {}

  /**
   * Synchronizes the complete project including endpoints, test cases, and steps.
   * 
   * @param projectId - The project ID to synchronize
   * @returns Promise<object> - Synchronization result with detailed statistics
   * @throws NotFoundException - If project not found
   * 
   * @example
   * ```typescript
   * const result = await syncService.syncProject('project-123');
   * console.log(`Sync completed: ${result.data.endpointsUpdated} endpoints updated`);
   * ```
   */
  async syncProject(projectId: string) {
    const startTime = Date.now();
    this.logger.log(`🔄 [SYNC] Starting complete project synchronization: ${projectId}`);

    // Verify that the project exists
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const result = {
      projectId,
      endpointsUpdated: 0,
      testCasesSynced: 0,
      stepsSynced: 0,
      scenariosAdded: 0,
      processingTime: 0,
      details: {
        sections: [] as string[],
        entities: [] as string[],
        errors: [] as string[]
      }
    };

    try {
      // Step 1: Synchronize endpoints
      this.logger.log(`📡 [SYNC] Step 1: Synchronizing endpoints...`);
      const endpointsResult = await this.syncEndpoints(projectId);
      result.endpointsUpdated = endpointsResult.endpointsUpdated;
      result.details.sections = endpointsResult.details.sections;
      result.details.entities = endpointsResult.details.entities;

      // Step 2: Synchronize test cases and steps
      this.logger.log(`🧪 [SYNC] Step 2: Synchronizing test cases and steps...`);
      const testCasesResult = await this.syncTestCases(projectId);
      result.testCasesSynced = testCasesResult.testCasesSynced;
      result.stepsSynced = testCasesResult.stepsSynced;
      result.scenariosAdded = testCasesResult.scenariosAdded;
      result.details.errors = [...result.details.errors, ...testCasesResult.details.errors];

      result.processingTime = Date.now() - startTime;
      
      this.logger.log(`✅ [SYNC] Synchronization completed in ${result.processingTime}ms`);
      this.logger.log(`📊 [SYNC] Summary: ${result.endpointsUpdated} endpoints, ${result.testCasesSynced} test cases, ${result.stepsSynced} steps, ${result.scenariosAdded} scenarios added`);

      return {
        success: true,
        message: `Project synchronized successfully in ${result.processingTime}ms`,
        data: result
      };

    } catch (error) {
      result.processingTime = Date.now() - startTime;
      result.details.errors.push(error.message);
      
      this.logger.error(`❌ [SYNC] Error in synchronization: ${error.message}`);
      
      return {
        success: false,
        message: `Error in synchronization: ${error.message}`,
        data: result
      };
    }
  }

  /**
   * Synchronizes only the endpoints of the project.
   * 
   * @param projectId - The project ID to synchronize endpoints for
   * @returns Promise<object> - Endpoints synchronization result
   * @throws NotFoundException - If project not found
   * 
   * @example
   * ```typescript
   * const result = await syncService.syncEndpoints('project-123');
   * console.log(`Endpoints synchronized: ${result.endpointsUpdated}`);
   * ```
   */
  async syncEndpoints(projectId: string) {
    this.logger.log(`📡 [SYNC-ENDPOINTS] Synchronizing project endpoints: ${projectId}`);

    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const sections: string[] = [];
    const entities: string[] = [];
    let endpointsUpdated = 0;
    let endpointsAdded = 0;

    try {
      // Clean existing duplicate endpoints
      await this.cleanDuplicateEndpoints(projectId);

      // Explore all section folders in the project
      const basePath = path.join(project.path, 'src');
      if (!fs.existsSync(basePath)) {
        this.logger.warn(`⚠️ [SYNC-ENDPOINTS] src folder not found: ${basePath}`);
        return { endpointsUpdated: 0, details: { sections, entities, errors: [] } };
      }

      // Search for section folders in features, fixtures, schemas, steps, types
      const sectionFolders = ['features', 'fixtures', 'schemas', 'steps', 'types'];
      const allSections = new Set<string>();
      const sectionEntities = new Map<string, Set<string>>();

      for (const folder of sectionFolders) {
        const folderPath = path.join(basePath, folder);
        if (fs.existsSync(folderPath)) {
          const sectionDirs = fs.readdirSync(folderPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

          for (const section of sectionDirs) {
            allSections.add(section);
            
            if (!sectionEntities.has(section)) {
              sectionEntities.set(section, new Set());
            }

            // Search for entities in this section
            const sectionPath = path.join(folderPath, section);
            const files = fs.readdirSync(sectionPath, { withFileTypes: true })
              .filter(dirent => dirent.isFile())
              .map(dirent => {
                const name = dirent.name;
                // Extract entity name from file
                let entityName = '';
                if (folder === 'features') {
                  entityName = name.replace('.feature', '');
                } else if (folder === 'steps') {
                  entityName = name.replace('.steps.ts', '');
                } else if (folder === 'fixtures') {
                  entityName = name.replace('.fixture.ts', '');
                } else if (folder === 'schemas') {
                  entityName = name.replace('.schema.ts', '');
                } else if (folder === 'types') {
                  entityName = name.replace('.ts', '');
                }
                
                // Normalize entity name (capitalize first letter)
                if (entityName) {
                  return entityName.charAt(0).toUpperCase() + entityName.slice(1);
                }
                return entityName;
              })
              .filter(entityName => entityName); // Filter empty names

            files.forEach(entity => sectionEntities.get(section)!.add(entity));
          }
        }
      }

      const sectionsArray = Array.from(allSections);
      this.logger.log(`📁 [SYNC-ENDPOINTS] Sections found: ${sectionsArray.join(', ')}`);

      for (const section of sectionsArray) {
        sections.push(section);
        const entitiesInSection = Array.from(sectionEntities.get(section) || []);
        
        this.logger.log(`📄 [SYNC-ENDPOINTS] Entities found in ${section}: ${entitiesInSection.join(', ')}`);

        for (const entityName of entitiesInSection) {
          entities.push(entityName);
          
          // Check if endpoint already exists (more specific search)
          let endpoint = await this.endpointRepository.findOne({
            where: { 
              projectId, 
              section, 
              entityName 
            }
          });

          // Verify that all necessary files exist
          const artifacts = {
            feature: `src/features/${section}/${entityName.toLowerCase()}.feature`,
            steps: `src/steps/${section}/${entityName.toLowerCase()}.steps.ts`,
            fixture: `src/fixtures/${section}/${entityName.toLowerCase()}.fixture.ts`,
            schema: `src/schemas/${section}/${entityName.toLowerCase()}.schema.ts`,
            types: `src/types/${section}/${entityName.toLowerCase()}.ts`,
            client: `src/api/${section}/${entityName.toLowerCase()}Client.ts`
          };

          // Verify that at least the feature file exists
          const featurePath = path.join(project.path, artifacts.feature);
          if (!fs.existsSync(featurePath)) {
            this.logger.warn(`⚠️ [SYNC-ENDPOINTS] Feature file not found for ${section}/${entityName}: ${featurePath}`);
            continue;
          }

          if (!endpoint) {
            // Create new endpoint
            endpoint = this.endpointRepository.create({
              projectId,
              section,
              entityName,
              name: `${section}/${entityName}`, // Required name field
              path: `/${entityName.toLowerCase()}s`,
              methods: [], // Empty array by default
              generatedArtifacts: artifacts
            });
            
            await this.endpointRepository.save(endpoint);
            endpointsAdded++;
            this.logger.log(`➕ [SYNC-ENDPOINTS] New endpoint created: ${section}/${entityName}`);
          } else {
            // Check if artifacts have changed
            const artifactsChanged = JSON.stringify(endpoint.generatedArtifacts) !== JSON.stringify(artifacts);
            
            if (artifactsChanged) {
              // Update existing artifacts
              endpoint.generatedArtifacts = artifacts;
              await this.endpointRepository.save(endpoint);
              endpointsUpdated++;
              this.logger.log(`🔄 [SYNC-ENDPOINTS] Endpoint updated: ${section}/${entityName}`);
            } else {
              this.logger.log(`✅ [SYNC-ENDPOINTS] Endpoint unchanged: ${section}/${entityName}`);
            }
          }
        }
      }

      const totalProcessed = endpointsAdded + endpointsUpdated;
      this.logger.log(`✅ [SYNC-ENDPOINTS] Synchronization completed: ${endpointsAdded} new, ${endpointsUpdated} updated (total: ${totalProcessed})`);

      return {
        endpointsUpdated: totalProcessed,
        details: { sections, entities, errors: [] }
      };

    } catch (error) {
      this.logger.error(`❌ [SYNC-ENDPOINTS] Error synchronizing endpoints: ${error.message}`);
      return {
        endpointsUpdated,
        details: { sections, entities, errors: [error.message] }
      };
    }
  }

  /**
   * Cleans duplicate endpoints in the database.
   * 
   * @private
   * @param projectId - The project ID to clean duplicates for
   */
  private async cleanDuplicateEndpoints(projectId: string): Promise<void> {
    try {
      // Get all project endpoints
      const endpoints = await this.endpointRepository.find({
        where: { projectId }
      });

      // Group by section and normalized entity
      const groupedEndpoints = new Map<string, Endpoint[]>();
      
      for (const endpoint of endpoints) {
        const key = `${endpoint.section}/${endpoint.entityName}`;
        if (!groupedEndpoints.has(key)) {
          groupedEndpoints.set(key, []);
        }
        groupedEndpoints.get(key)!.push(endpoint);
      }

      // Remove duplicates, keeping only the most recent
      for (const [key, duplicateEndpoints] of groupedEndpoints) {
        if (duplicateEndpoints.length > 1) {
          this.logger.log(`🧹 [SYNC-ENDPOINTS] Found ${duplicateEndpoints.length} duplicate endpoints for ${key}`);
          
          // Sort by creation date (most recent first)
          duplicateEndpoints.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          
          // Keep the first (most recent) and delete the rest
          const toDelete = duplicateEndpoints.slice(1);
          
          for (const endpointToDelete of toDelete) {
            await this.endpointRepository.remove(endpointToDelete);
            this.logger.log(`🗑️ [SYNC-ENDPOINTS] Deleted duplicate endpoint: ${endpointToDelete.id}`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`❌ [SYNC-ENDPOINTS] Error cleaning duplicate endpoints: ${error.message}`);
    }
  }

  /**
   * Synchronizes test cases and steps of the project.
   * 
   * @param projectId - The project ID to synchronize test cases for
   * @returns Promise<object> - Test cases synchronization result
   * @throws NotFoundException - If project not found
   * 
   * @example
   * ```typescript
   * const result = await syncService.syncTestCases('project-123');
   * console.log(`Test cases synchronized: ${result.testCasesSynced}`);
   * ```
   */
  async syncTestCases(projectId: string) {
    this.logger.log(`🧪 [SYNC-TESTCASES] Synchronizing project test cases: ${projectId}`);

    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const errors: string[] = [];
    let testCasesSynced = 0;
    let stepsSynced = 0;
    let scenariosAdded = 0;

    try {
      // Get all project endpoints
      const endpoints = await this.endpointRepository.find({
        where: { projectId }
      });

      this.logger.log(`📊 [SYNC-TESTCASES] Processing ${endpoints.length} endpoints`);

      for (const endpoint of endpoints) {
        try {
          this.logger.log(`🔍 [SYNC-TESTCASES] Processing ${endpoint.section}/${endpoint.entityName}`);

          // Check if files exist for this entity
          const featurePath = path.join(project.path, endpoint.generatedArtifacts?.feature || '');
          const stepsPath = path.join(project.path, endpoint.generatedArtifacts?.steps || '');

          if (!endpoint.generatedArtifacts?.feature || !fs.existsSync(featurePath)) {
            this.logger.warn(`⚠️ [SYNC-TESTCASES] Feature file not found: ${featurePath}`);
            continue;
          }

          if (!endpoint.generatedArtifacts?.steps || !fs.existsSync(stepsPath)) {
            this.logger.warn(`⚠️ [SYNC-TESTCASES] Steps file not found: ${stepsPath}`);
            continue;
          }

          // Count existing test cases before synchronization
          const existingTestCasesCount = await this.testCaseRepository.count({
            where: { projectId, entityName: endpoint.entityName }
          });

          const existingStepsCount = await this.testStepRepository.count({
            where: { projectId, entityName: endpoint.entityName }
          });

          // Delete existing test cases and steps for this entity (to avoid duplicates)
          await this.testCaseRepository.delete({ projectId, entityName: endpoint.entityName });
          await this.testStepRepository.delete({ projectId, entityName: endpoint.entityName });

          this.logger.log(`🗑️ [SYNC-TESTCASES] Existing data deleted for ${endpoint.entityName}`);

          // SPECIFIC SYNC LOGIC: Detect existing test cases in .feature file
          const testCasesDetected = await this.detectTestCasesFromFeatureFile(
            projectId,
            endpoint.section,
            endpoint.entityName,
            featurePath
          );

          // Register detected test cases
          for (const testCase of testCasesDetected) {
            await this.createTestCaseFromSync(
              projectId,
              endpoint.section,
              endpoint.entityName,
              testCase
            );
          }

          // Count test cases after synchronization
          const newTestCasesCount = await this.testCaseRepository.count({
            where: { projectId, entityName: endpoint.entityName }
          });

          // Register steps from steps file (reusing existing logic)
          await this.testStepRegistrationService.processStepsFileAndRegisterSteps(
            projectId,
            endpoint.section,
            endpoint.entityName
          );

          // Count steps after synchronization
          const newStepsCount = await this.testStepRepository.count({
            where: { projectId, entityName: endpoint.entityName }
          });

          // Calculate differences
          const testCasesDiff = newTestCasesCount - existingTestCasesCount;
          const stepsDiff = newStepsCount - existingStepsCount;

          testCasesSynced += newTestCasesCount;
          stepsSynced += newStepsCount;
          scenariosAdded += Math.max(0, testCasesDiff); // Only count new ones

          this.logger.log(`✅ [SYNC-TESTCASES] ${endpoint.entityName}: ${newTestCasesCount} test cases (${testCasesDiff > 0 ? '+' + testCasesDiff : 'no changes'}), ${newStepsCount} steps (${stepsDiff > 0 ? '+' + stepsDiff : 'no changes'})`);

        } catch (error) {
          const errorMsg = `Error processing ${endpoint.section}/${endpoint.entityName}: ${error.message}`;
          this.logger.error(`❌ [SYNC-TESTCASES] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      this.logger.log(`✅ [SYNC-TESTCASES] Synchronization completed: ${testCasesSynced} test cases, ${stepsSynced} steps, ${scenariosAdded} scenarios added`);

      return {
        testCasesSynced,
        stepsSynced,
        scenariosAdded,
        details: { errors }
      };

    } catch (error) {
      this.logger.error(`❌ [SYNC-TESTCASES] Error in synchronization: ${error.message}`);
      errors.push(error.message);
      
      return {
        testCasesSynced,
        stepsSynced,
        scenariosAdded,
        details: { errors }
      };
    }
  }

  /**
   * Detects existing test cases in a .feature file.
   * 
   * @private
   * @param projectId - The project ID
   * @param section - The section name
   * @param entityName - The entity name
   * @param featurePath - The path to the feature file
   * @returns Promise<Array<object>> - Array of detected test cases
   */
  private async detectTestCasesFromFeatureFile(
    projectId: string,
    section: string,
    entityName: string,
    featurePath: string
  ): Promise<Array<{
    testCaseId: string;
    scenarioName: string;
    tags: string[];
    steps: string;
    method: string;
  }>> {
    const testCases: Array<{
      testCaseId: string;
      scenarioName: string;
      tags: string[];
      steps: string;
      method: string;
    }> = [];

    try {
      const featureContent = fs.readFileSync(featurePath, 'utf-8');
      const lines = featureContent.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Search for lines containing test case tags (already with assigned ID)
        const tcMatch = line.match(/@TC-([^-]+)-([^-]+)-(\d+)/);
        if (tcMatch) {
          const [, tcSection, tcEntity, tcNumber] = tcMatch;
          
          // Verify that it corresponds to this section and entity
          if (tcSection.toUpperCase() === section.toUpperCase() && 
              tcEntity.toUpperCase() === entityName.toUpperCase()) {
            
            const testCaseId = `TC-${tcSection}-${tcEntity}-${tcNumber}`;
            
            // Extract scenario tags
            const tags = this.extractTagsForScenario(lines, i);
            
            // Search for scenario name
            let scenarioName = '';
            let steps = '';
            
            for (let j = i + 1; j < lines.length; j++) {
              const nextLine = lines[j].trim();
              if (nextLine.startsWith('Scenario:') || nextLine.startsWith('Scenario Outline:')) {
                scenarioName = nextLine.replace('Scenario:', '').replace('Scenario Outline:', '').trim();
                steps = this.extractStepsFromScenario(lines, j + 1);
                break;
              }
              if (nextLine.startsWith('@') || nextLine === '') continue;
            }
            
            if (scenarioName) {
              const method = this.determineMethodFromScenario(scenarioName, []);
              
              this.logger.log(`🔍 [SYNC-TESTCASES] Detected test case: ${testCaseId} - "${scenarioName}"`);
              
              testCases.push({
                testCaseId,
                scenarioName,
                tags,
                steps,
                method
              });
            }
          }
        }
      }

      this.logger.log(`📊 [SYNC-TESTCASES] Total test cases detected in ${entityName}: ${testCases.length}`);
      return testCases;

    } catch (error) {
      this.logger.error(`❌ [SYNC-TESTCASES] Error detecting test cases: ${error.message}`);
      return [];
    }
  }

  /**
   * Extracts tags for a scenario (similar logic to test-case-registration but simplified).
   * 
   * @private
   * @param lines - Array of file lines
   * @param tagLineIndex - Index of the tag line
   * @returns string[] - Array of extracted tags
   */
  private extractTagsForScenario(lines: string[], tagLineIndex: number): string[] {
    const tags: string[] = [];

    const extractTokens = (line: string): string[] => {
      return line
        .split(/[,\s]+/)
        .map(t => t.trim())
        .filter(t => t && t.startsWith('@') && !/^@TC-/i.test(t)); // Exclude test case tags
    };
    
    // Search for tags upward from the TC tag line
    for (let i = tagLineIndex; i >= 0; i--) {
      const line = lines[i].trim();
      if (line === '') break;
      if (line.startsWith('@')) {
        const tokens = extractTokens(line);
        for (let k = tokens.length - 1; k >= 0; k--) {
          tags.unshift(tokens[k]);
        }
      } else if (!line.startsWith('Feature:') && !line.startsWith('Background:')) {
        break;
      }
    }
    
    // Search for tags downward from the TC tag line
    for (let i = tagLineIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') break;
      if (line.startsWith('Scenario:') || line.startsWith('Scenario Outline:')) {
        break;
      }
      if (line.startsWith('@')) {
        const tokens = extractTokens(line);
        tokens.forEach(t => tags.push(t));
      }
    }
    
    return tags;
  }

  /**
   * Extracts steps from a scenario (similar logic to test-case-registration).
   * 
   * @private
   * @param lines - Array of file lines
   * @param startLineIndex - Starting line index for extraction
   * @returns string - Extracted steps as a string
   */
  private extractStepsFromScenario(lines: string[], startLineIndex: number): string {
    const steps: string[] = [];
    
    for (let i = startLineIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('Scenario:') || line.startsWith('Scenario Outline:')) {
        break;
      }
      
      if (line === '' && i + 1 < lines.length && lines[i + 1].trim().startsWith('@')) {
        break;
      }
      
      if (line !== '' && !line.startsWith('@')) {
        steps.push(line);
      }
    }
    
    return steps.join('\n');
  }

  /**
   * Determines the HTTP method based on the scenario name.
   * 
   * @private
   * @param scenarioName - The scenario name
   * @param methods - Array of available methods
   * @returns string - The determined HTTP method
   */
  private determineMethodFromScenario(scenarioName: string, methods: any[]): string {
    const scenarioLower = scenarioName.toLowerCase();
    if (scenarioLower.includes('create') || scenarioLower.includes('post')) return 'POST';
    if (scenarioLower.includes('get') || scenarioLower.includes('read')) return 'GET';
    if (scenarioLower.includes('update') || scenarioLower.includes('patch')) return 'PATCH';
    if (scenarioLower.includes('replace') || scenarioLower.includes('put')) return 'PUT';
    if (scenarioLower.includes('delete') || scenarioLower.includes('remove')) return 'DELETE';
    return methods[0]?.method || 'GET';
  }

  /**
   * Creates a test case from synchronization.
   * 
   * @private
   * @param projectId - The project ID
   * @param section - The section name
   * @param entityName - The entity name
   * @param testCase - The test case data
   */
  private async createTestCaseFromSync(
    projectId: string,
    section: string,
    entityName: string,
    testCase: {
      testCaseId: string;
      scenarioName: string;
      tags: string[];
      steps: string;
      method: string;
    }
  ): Promise<void> {
    try {
      const testType = this.determineTestType(testCase.scenarioName);
      
      this.logger.log(`💾 [SYNC-TESTCASES] Saving test case: ${testCase.testCaseId} - ${testCase.scenarioName}`);
      
      const testCaseEntity = this.testCaseRepository.create({
        testCaseId: testCase.testCaseId,
        projectId,
        entityName,
        section,
        name: testCase.scenarioName,
        description: `Test case detected during sync for ${entityName} ${testCase.method} operation`,
        tags: testCase.tags,
        method: testCase.method,
        testType: testType as TestType,
        scenario: testCase.steps,
        status: TestCaseStatus.ACTIVE,
      });
      
      await this.testCaseRepository.save(testCaseEntity);
      
    } catch (error) {
      this.logger.error(`❌ [SYNC-TESTCASES] Error creating test case ${testCase.testCaseId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Determines the test type based on the scenario name.
   * 
   * @private
   * @param scenarioName - The scenario name
   * @returns TestType - The determined test type
   */
  private determineTestType(scenarioName: string): TestType {
    const scenarioLower = scenarioName.toLowerCase();
    if (scenarioLower.includes('invalid') || scenarioLower.includes('missing') || scenarioLower.includes('error')) {
      return TestType.NEGATIVE;
    }
    if (scenarioLower.includes('regression')) {
      return TestType.POSITIVE;
    }
    return TestType.POSITIVE;
  }
}
