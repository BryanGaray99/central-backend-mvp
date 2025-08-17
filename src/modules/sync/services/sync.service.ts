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
   * Sincroniza todo el proyecto: endpoints, test cases y steps
   */
  async syncProject(projectId: string) {
    const startTime = Date.now();
    this.logger.log(`🔄 [SYNC] Iniciando sincronización completa del proyecto: ${projectId}`);

    // Verificar que el proyecto existe
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException(`Proyecto con ID ${projectId} no encontrado`);
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
      // Paso 1: Sincronizar endpoints
      this.logger.log(`📡 [SYNC] Paso 1: Sincronizando endpoints...`);
      const endpointsResult = await this.syncEndpoints(projectId);
      result.endpointsUpdated = endpointsResult.endpointsUpdated;
      result.details.sections = endpointsResult.details.sections;
      result.details.entities = endpointsResult.details.entities;

      // Paso 2: Sincronizar test cases y steps
      this.logger.log(`🧪 [SYNC] Paso 2: Sincronizando test cases y steps...`);
      const testCasesResult = await this.syncTestCases(projectId);
      result.testCasesSynced = testCasesResult.testCasesSynced;
      result.stepsSynced = testCasesResult.stepsSynced;
      result.scenariosAdded = testCasesResult.scenariosAdded;
      result.details.errors = [...result.details.errors, ...testCasesResult.details.errors];

      result.processingTime = Date.now() - startTime;
      
      this.logger.log(`✅ [SYNC] Sincronización completada en ${result.processingTime}ms`);
      this.logger.log(`📊 [SYNC] Resumen: ${result.endpointsUpdated} endpoints, ${result.testCasesSynced} test cases, ${result.stepsSynced} steps, ${result.scenariosAdded} scenarios agregados`);

      return {
        success: true,
        message: `Proyecto sincronizado exitosamente en ${result.processingTime}ms`,
        data: result
      };

    } catch (error) {
      result.processingTime = Date.now() - startTime;
      result.details.errors.push(error.message);
      
      this.logger.error(`❌ [SYNC] Error en sincronización: ${error.message}`);
      
      return {
        success: false,
        message: `Error en sincronización: ${error.message}`,
        data: result
      };
    }
  }

  /**
   * Sincroniza solo los endpoints del proyecto
   */
  async syncEndpoints(projectId: string) {
    this.logger.log(`📡 [SYNC-ENDPOINTS] Sincronizando endpoints del proyecto: ${projectId}`);

    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException(`Proyecto con ID ${projectId} no encontrado`);
    }

    const sections: string[] = [];
    const entities: string[] = [];
    let endpointsUpdated = 0;
    let endpointsAdded = 0;

    try {
      // Limpiar endpoints duplicados existentes
      await this.cleanDuplicateEndpoints(projectId);

      // Explorar todas las carpetas de secciones en el proyecto
      const basePath = path.join(project.path, 'src');
      if (!fs.existsSync(basePath)) {
        this.logger.warn(`⚠️ [SYNC-ENDPOINTS] No se encontró la carpeta src: ${basePath}`);
        return { endpointsUpdated: 0, details: { sections, entities, errors: [] } };
      }

      // Buscar carpetas de secciones en features, fixtures, schemas, steps, types
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

            // Buscar entidades en esta sección
            const sectionPath = path.join(folderPath, section);
            const files = fs.readdirSync(sectionPath, { withFileTypes: true })
              .filter(dirent => dirent.isFile())
              .map(dirent => {
                const name = dirent.name;
                // Extraer el nombre de la entidad del archivo
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
                
                // Normalizar el nombre de la entidad (capitalizar primera letra)
                if (entityName) {
                  return entityName.charAt(0).toUpperCase() + entityName.slice(1);
                }
                return entityName;
              })
              .filter(entityName => entityName); // Filtrar nombres vacíos

            files.forEach(entity => sectionEntities.get(section)!.add(entity));
          }
        }
      }

      const sectionsArray = Array.from(allSections);
      this.logger.log(`📁 [SYNC-ENDPOINTS] Secciones encontradas: ${sectionsArray.join(', ')}`);

      for (const section of sectionsArray) {
        sections.push(section);
        const entitiesInSection = Array.from(sectionEntities.get(section) || []);
        
        this.logger.log(`📄 [SYNC-ENDPOINTS] Entidades encontradas en ${section}: ${entitiesInSection.join(', ')}`);

        for (const entityName of entitiesInSection) {
          entities.push(entityName);
          
          // Verificar si el endpoint ya existe (búsqueda más específica)
          let endpoint = await this.endpointRepository.findOne({
            where: { 
              projectId, 
              section, 
              entityName 
            }
          });

          // Verificar que todos los archivos necesarios existen
          const artifacts = {
            feature: `src/features/${section}/${entityName.toLowerCase()}.feature`,
            steps: `src/steps/${section}/${entityName.toLowerCase()}.steps.ts`,
            fixture: `src/fixtures/${section}/${entityName.toLowerCase()}.fixture.ts`,
            schema: `src/schemas/${section}/${entityName.toLowerCase()}.schema.ts`,
            types: `src/types/${section}/${entityName.toLowerCase()}.ts`,
            client: `src/api/${section}/${entityName.toLowerCase()}Client.ts`
          };

          // Verificar que al menos el archivo feature existe
          const featurePath = path.join(project.path, artifacts.feature);
          if (!fs.existsSync(featurePath)) {
            this.logger.warn(`⚠️ [SYNC-ENDPOINTS] Archivo feature no encontrado para ${section}/${entityName}: ${featurePath}`);
            continue;
          }

          if (!endpoint) {
            // Crear nuevo endpoint
            endpoint = this.endpointRepository.create({
              projectId,
              section,
              entityName,
              name: `${section}/${entityName}`, // Campo name requerido
              path: `/${entityName.toLowerCase()}s`,
              methods: [], // Array vacío por defecto
              generatedArtifacts: artifacts
            });
            
            await this.endpointRepository.save(endpoint);
            endpointsAdded++;
            this.logger.log(`➕ [SYNC-ENDPOINTS] Nuevo endpoint creado: ${section}/${entityName}`);
          } else {
            // Verificar si los artifacts han cambiado
            const artifactsChanged = JSON.stringify(endpoint.generatedArtifacts) !== JSON.stringify(artifacts);
            
            if (artifactsChanged) {
              // Actualizar artifacts existente
              endpoint.generatedArtifacts = artifacts;
              await this.endpointRepository.save(endpoint);
              endpointsUpdated++;
              this.logger.log(`🔄 [SYNC-ENDPOINTS] Endpoint actualizado: ${section}/${entityName}`);
            } else {
              this.logger.log(`✅ [SYNC-ENDPOINTS] Endpoint sin cambios: ${section}/${entityName}`);
            }
          }
        }
      }

      const totalProcessed = endpointsAdded + endpointsUpdated;
      this.logger.log(`✅ [SYNC-ENDPOINTS] Sincronización completada: ${endpointsAdded} nuevos, ${endpointsUpdated} actualizados (total: ${totalProcessed})`);

      return {
        endpointsUpdated: totalProcessed,
        details: { sections, entities, errors: [] }
      };

    } catch (error) {
      this.logger.error(`❌ [SYNC-ENDPOINTS] Error sincronizando endpoints: ${error.message}`);
      return {
        endpointsUpdated,
        details: { sections, entities, errors: [error.message] }
      };
    }
  }

  /**
   * Limpia endpoints duplicados en la base de datos
   */
  private async cleanDuplicateEndpoints(projectId: string): Promise<void> {
    try {
      // Obtener todos los endpoints del proyecto
      const endpoints = await this.endpointRepository.find({
        where: { projectId }
      });

      // Agrupar por sección y entidad normalizada
      const groupedEndpoints = new Map<string, Endpoint[]>();
      
      for (const endpoint of endpoints) {
        const key = `${endpoint.section}/${endpoint.entityName}`;
        if (!groupedEndpoints.has(key)) {
          groupedEndpoints.set(key, []);
        }
        groupedEndpoints.get(key)!.push(endpoint);
      }

      // Eliminar duplicados, manteniendo solo el más reciente
      for (const [key, duplicateEndpoints] of groupedEndpoints) {
        if (duplicateEndpoints.length > 1) {
          this.logger.log(`🧹 [SYNC-ENDPOINTS] Encontrados ${duplicateEndpoints.length} endpoints duplicados para ${key}`);
          
          // Ordenar por fecha de creación (más reciente primero)
          duplicateEndpoints.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          
          // Mantener el primero (más reciente) y eliminar los demás
          const toDelete = duplicateEndpoints.slice(1);
          
          for (const endpointToDelete of toDelete) {
            await this.endpointRepository.remove(endpointToDelete);
            this.logger.log(`🗑️ [SYNC-ENDPOINTS] Eliminado endpoint duplicado: ${endpointToDelete.id}`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`❌ [SYNC-ENDPOINTS] Error limpiando endpoints duplicados: ${error.message}`);
    }
  }

  /**
   * Sincroniza test cases y steps del proyecto
   */
  async syncTestCases(projectId: string) {
    this.logger.log(`🧪 [SYNC-TESTCASES] Sincronizando test cases del proyecto: ${projectId}`);

    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException(`Proyecto con ID ${projectId} no encontrado`);
    }

    const errors: string[] = [];
    let testCasesSynced = 0;
    let stepsSynced = 0;
    let scenariosAdded = 0;

    try {
      // Obtener todos los endpoints del proyecto
      const endpoints = await this.endpointRepository.find({
        where: { projectId }
      });

      this.logger.log(`📊 [SYNC-TESTCASES] Procesando ${endpoints.length} endpoints`);

      for (const endpoint of endpoints) {
        try {
          this.logger.log(`🔍 [SYNC-TESTCASES] Procesando ${endpoint.section}/${endpoint.entityName}`);

          // Verificar si existen archivos para esta entidad
          const featurePath = path.join(project.path, endpoint.generatedArtifacts?.feature || '');
          const stepsPath = path.join(project.path, endpoint.generatedArtifacts?.steps || '');

          if (!endpoint.generatedArtifacts?.feature || !fs.existsSync(featurePath)) {
            this.logger.warn(`⚠️ [SYNC-TESTCASES] Archivo feature no encontrado: ${featurePath}`);
            continue;
          }

          if (!endpoint.generatedArtifacts?.steps || !fs.existsSync(stepsPath)) {
            this.logger.warn(`⚠️ [SYNC-TESTCASES] Archivo steps no encontrado: ${stepsPath}`);
            continue;
          }

          // Contar test cases existentes antes de la sincronización
          const existingTestCasesCount = await this.testCaseRepository.count({
            where: { projectId, entityName: endpoint.entityName }
          });

          const existingStepsCount = await this.testStepRepository.count({
            where: { projectId, entityName: endpoint.entityName }
          });

          // Eliminar test cases y steps existentes para esta entidad (para evitar duplicados)
          await this.testCaseRepository.delete({ projectId, entityName: endpoint.entityName });
          await this.testStepRepository.delete({ projectId, entityName: endpoint.entityName });

          this.logger.log(`🗑️ [SYNC-TESTCASES] Datos existentes eliminados para ${endpoint.entityName}`);

          // LÓGICA ESPECÍFICA PARA SYNC: Detectar test cases existentes en el archivo .feature
          const testCasesDetected = await this.detectTestCasesFromFeatureFile(
            projectId,
            endpoint.section,
            endpoint.entityName,
            featurePath
          );

          // Registrar test cases detectados
          for (const testCase of testCasesDetected) {
            await this.createTestCaseFromSync(
              projectId,
              endpoint.section,
              endpoint.entityName,
              testCase
            );
          }

          // Contar test cases después de la sincronización
          const newTestCasesCount = await this.testCaseRepository.count({
            where: { projectId, entityName: endpoint.entityName }
          });

          // Registrar steps desde archivo steps (reutilizando la lógica existente)
          await this.testStepRegistrationService.processStepsFileAndRegisterSteps(
            projectId,
            endpoint.section,
            endpoint.entityName
          );

          // Contar steps después de la sincronización
          const newStepsCount = await this.testStepRepository.count({
            where: { projectId, entityName: endpoint.entityName }
          });

          // Calcular diferencias
          const testCasesDiff = newTestCasesCount - existingTestCasesCount;
          const stepsDiff = newStepsCount - existingStepsCount;

          testCasesSynced += newTestCasesCount;
          stepsSynced += newStepsCount;
          scenariosAdded += Math.max(0, testCasesDiff); // Solo contar los nuevos

          this.logger.log(`✅ [SYNC-TESTCASES] ${endpoint.entityName}: ${newTestCasesCount} test cases (${testCasesDiff > 0 ? '+' + testCasesDiff : 'sin cambios'}), ${newStepsCount} steps (${stepsDiff > 0 ? '+' + stepsDiff : 'sin cambios'})`);

        } catch (error) {
          const errorMsg = `Error procesando ${endpoint.section}/${endpoint.entityName}: ${error.message}`;
          this.logger.error(`❌ [SYNC-TESTCASES] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      this.logger.log(`✅ [SYNC-TESTCASES] Sincronización completada: ${testCasesSynced} test cases, ${stepsSynced} steps, ${scenariosAdded} scenarios agregados`);

      return {
        testCasesSynced,
        stepsSynced,
        scenariosAdded,
        details: { errors }
      };

    } catch (error) {
      this.logger.error(`❌ [SYNC-TESTCASES] Error en sincronización: ${error.message}`);
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
   * Detecta test cases existentes en un archivo .feature
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
        
        // Buscar líneas que contengan tags de test cases (ya con ID asignado)
        const tcMatch = line.match(/@TC-([^-]+)-([^-]+)-(\d+)/);
        if (tcMatch) {
          const [, tcSection, tcEntity, tcNumber] = tcMatch;
          
          // Verificar que corresponde a esta sección y entidad
          if (tcSection.toUpperCase() === section.toUpperCase() && 
              tcEntity.toUpperCase() === entityName.toUpperCase()) {
            
            const testCaseId = `TC-${tcSection}-${tcEntity}-${tcNumber}`;
            
            // Extraer tags del escenario
            const tags = this.extractTagsForScenario(lines, i);
            
            // Buscar el nombre del escenario
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
              
              this.logger.log(`🔍 [SYNC-TESTCASES] Detectado test case: ${testCaseId} - "${scenarioName}"`);
              
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

      this.logger.log(`📊 [SYNC-TESTCASES] Total test cases detectados en ${entityName}: ${testCases.length}`);
      return testCases;

    } catch (error) {
      this.logger.error(`❌ [SYNC-TESTCASES] Error detectando test cases: ${error.message}`);
      return [];
    }
  }

  /**
   * Extrae tags para un escenario (lógica similar a test-case-registration pero simplificada)
   */
  private extractTagsForScenario(lines: string[], tagLineIndex: number): string[] {
    const tags: string[] = [];

    const extractTokens = (line: string): string[] => {
      return line
        .split(/[,\s]+/)
        .map(t => t.trim())
        .filter(t => t && t.startsWith('@') && !/^@TC-/i.test(t)); // Excluir tags de test cases
    };
    
    // Buscar tags hacia arriba desde la línea del tag TC
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
    
    // Buscar tags hacia abajo desde la línea del tag TC
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
   * Extrae steps de un escenario (lógica similar a test-case-registration)
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
   * Determina el método HTTP basado en el nombre del escenario
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
   * Crea un test case desde la sincronización
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
      
      this.logger.log(`💾 [SYNC-TESTCASES] Guardando test case: ${testCase.testCaseId} - ${testCase.scenarioName}`);
      
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
      this.logger.error(`❌ [SYNC-TESTCASES] Error creando test case ${testCase.testCaseId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Determina el tipo de test basado en el nombre del escenario
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
