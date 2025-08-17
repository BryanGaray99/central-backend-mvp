import { Injectable, Logger } from '@nestjs/common';
import { TestCase } from '../entities/test-case.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../../projects/project.entity';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class FeatureFileManagerService {
  private readonly logger = new Logger(FeatureFileManagerService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  async addTestCaseToFeature(
    projectId: string,
    section: string,
    entityName: string,
    testCase: TestCase,
  ): Promise<void> {
    try {
      const featurePath = await this.getFeatureFilePath(projectId, section, entityName);
      const featureContent = await this.readFeatureFile(featurePath);
      
      const newScenario = this.generateScenarioFromTestCase(testCase);
      const updatedContent = this.addScenarioToFeature(featureContent, newScenario);
      
      await this.writeFeatureFile(featurePath, updatedContent);
      
      this.logger.log(`Added test case ${testCase.testCaseId} to feature file: ${featurePath}`);
    } catch (error) {
      this.logger.error(`Error adding test case to feature file: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Returns the highest numeric suffix found in @TC-{section}-{entity}-{NN} tags inside the feature file
   */
  async getMaxNumberFromFeature(projectId: string, section: string, entityName: string): Promise<number> {
    try {
      const featurePath = await this.getFeatureFilePath(projectId, section, entityName);
      const content = await this.readFeatureFile(featurePath);
      const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`@TC-${esc(section)}-${esc(entityName)}-(\\d+)`, 'g');
      let max = 0;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(content)) !== null) {
        const num = parseInt(m[1], 10);
        if (!Number.isNaN(num) && num > max) max = num;
      }
      return max;
    } catch (e) {
      // If file doesn't exist yet, return 0
      return 0;
    }
  }

  async updateTestCaseInFeature(
    projectId: string,
    section: string,
    entityName: string,
    testCase: TestCase,
  ): Promise<void> {
    try {
      const featurePath = await this.getFeatureFilePath(projectId, section, entityName);
      const featureContent = await this.readFeatureFile(featurePath);
      
      const updatedScenario = this.generateScenarioFromTestCase(testCase);
      const updatedContent = this.updateScenarioInFeature(featureContent, testCase.testCaseId, updatedScenario);
      
      await this.writeFeatureFile(featurePath, updatedContent);
      
      this.logger.log(`Updated test case ${testCase.testCaseId} in feature file: ${featurePath}`);
    } catch (error) {
      this.logger.error(`Error updating test case in feature file: ${error.message}`, error.stack);
      throw error;
    }
  }

  async removeTestCaseFromFeature(
    projectId: string,
    section: string,
    entityName: string,
    testCase: TestCase,
  ): Promise<void> {
    try {
      const featurePath = await this.getFeatureFilePath(projectId, section, entityName);
      const featureContent = await this.readFeatureFile(featurePath);
      
      const updatedContent = this.removeScenarioFromFeature(featureContent, testCase.testCaseId);
      
      await this.writeFeatureFile(featurePath, updatedContent);
      
      this.logger.log(`Removed test case ${testCase.testCaseId} from feature file: ${featurePath}`);
    } catch (error) {
      this.logger.error(`Error removing test case from feature file: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async getFeatureFilePath(projectId: string, section: string, entityName: string): Promise<string> {
    // Get project from database to get the correct path
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`);
    }

    // Use project.path instead of process.cwd()
    return path.join(project.path, 'src', 'features', section, `${entityName.toLowerCase()}.feature`);
  }

  private async readFeatureFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, create basic structure
        return this.createBasicFeatureStructure();
      }
      throw error;
    }
  }

  private async writeFeatureFile(filePath: string, content: string): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(filePath, content, 'utf-8');
  }

  private createBasicFeatureStructure(): string {
    return `Feature: API Testing

  Background:
    Given I have a valid API client
    And I am authenticated

`;
  }

  private generateScenarioFromTestCase(testCase: TestCase): string {
    // Generar el escenario con la estructura correcta del archivo feature
    const tags = testCase.tags.map(tag => tag.startsWith('@') ? tag : `@${tag}`).join(' ');
    const scenarioName = testCase.name;
    
    // Estructura según el nuevo template: línea con @TC-{id}, líneas con otros tags, línea con Scenario, contenido del scenario
    const scenarioLines = testCase.scenario.split('\n');
    const indentedSteps = scenarioLines.map(line => `    ${line}`).join('\n');
    
    // Generar solo el contenido del escenario con tags en línea separada
    const scenarioContent = `  @${testCase.testCaseId}\n  ${tags}\n  Scenario: ${scenarioName}\n${indentedSteps}`;
    
    // Debug: verificar el formato generado
    this.logger.log(`Generated scenario content: ${scenarioContent.substring(0, 100)}...`);
    
    return scenarioContent;
  }

  private addScenarioToFeature(featureContent: string, newScenario: string): string {
    let content = featureContent;
    // Ensure file ends with a newline
    if (!content.endsWith('\n')) content += '\n';
    // Ensure a blank line before the new scenario for readability
    content += '\n';
    return content + newScenario;
  }

  private updateScenarioInFeature(featureContent: string, testCaseId: string, updatedScenario: string): string {
    // Buscar el tag específico del test case (ej: @TC-ecommerce-Product-7)
    const escapedTestCaseId = testCaseId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Buscar la línea exacta del test case ID
    const testCaseIdLineRegex = new RegExp(
      `(\\n\\s*@${escapedTestCaseId})`,
      'g'
    );
    
    if (testCaseIdLineRegex.test(featureContent)) {
      // Extraer solo el contenido del escenario sin el test case ID
      const scenarioLines = updatedScenario.split('\n');
      // Saltar la primera línea (test case ID) y mantener el resto con el formato correcto
      const scenarioContent = scenarioLines.slice(1).join('\n'); // Esto incluye los tags en línea separada
      
      // Buscar desde el test case ID hasta el siguiente test case ID o final del archivo
      const fullScenarioRegex = new RegExp(
        `(\\n\\s*@${escapedTestCaseId})[\\s\\S]*?(?=\\n\\s*@TC-|\\n\\s*Feature:|$)`,
        'g'
      );
      
      // Reemplazar manteniendo el test case ID original y agregando el nuevo contenido
      const replacement = `$1\n${scenarioContent}`;
      const updatedContent = featureContent.replace(fullScenarioRegex, replacement);
      
      this.logger.log(`Updated test case ${testCaseId} in feature file`);
      this.logger.log(`Replacement: ${replacement.substring(0, 100)}...`);
      
      return updatedContent;
    }
    
    // If scenario not found, add it
    this.logger.log(`Test case ${testCaseId} not found in feature file, adding new scenario`);
    return this.addScenarioToFeature(featureContent, updatedScenario);
  }

  private removeScenarioFromFeature(featureContent: string, testCaseId: string): string {
    // Buscar el tag específico del test case (ej: @TC-ecommerce-Product-7)
    const escapedTestCaseId = testCaseId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Regex que busca desde la línea que contiene @TC-{testCaseId} hasta el siguiente @TC- o final del archivo
    // Estructura: línea con @TC-{id}, líneas con otros tags, línea con Scenario, contenido del scenario
    const scenarioRegex = new RegExp(
      `\\n\\s*@${escapedTestCaseId}\\s*\\n[\\s\\S]*?(?=\\n\\s*@TC-|\\n\\s*Feature:|$)`,
      'g'
    );
    
    // Debug: verificar si el regex encuentra algo
    const matches = featureContent.match(scenarioRegex);
    this.logger.log(`Found ${matches ? matches.length : 0} matches for test case ${testCaseId}`);
    if (matches) {
      this.logger.log(`Match found: ${matches[0].substring(0, 200)}...`);
      this.logger.log(`Match length: ${matches[0].length}`);
    } else {
      this.logger.warn(`No matches found for test case ${testCaseId}`);
      // Intentar con un regex más simple para debugging
      const simpleRegex = new RegExp(`@${escapedTestCaseId}`, 'g');
      const simpleMatches = featureContent.match(simpleRegex);
      this.logger.log(`Simple search found ${simpleMatches ? simpleMatches.length : 0} matches for ${testCaseId}`);
    }
    
    const updatedContent = featureContent.replace(scenarioRegex, '');
    
    // Log para debugging
    this.logger.log(`Removing test case ${testCaseId} from feature file`);
    this.logger.log(`Original content length: ${featureContent.length}`);
    this.logger.log(`Updated content length: ${updatedContent.length}`);
    
    return updatedContent;
  }
} 