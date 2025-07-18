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
    const tags = testCase.tags.map(tag => `@${tag}`).join(' ');
    const scenarioName = testCase.name;
    
    // Ahora el scenario es un string, así que simplemente lo usamos directamente
    // pero necesitamos agregar los tags y el nombre del escenario
    const scenarioLines = testCase.scenario.split('\n');
    const indentedSteps = scenarioLines.map(line => `    ${line}`).join('\n');
    
    return `\n  ${tags}\n  Scenario: ${scenarioName}\n${indentedSteps}\n`;
  }

  private addScenarioToFeature(featureContent: string, newScenario: string): string {
    return featureContent + newScenario;
  }

  private updateScenarioInFeature(featureContent: string, testCaseId: string, updatedScenario: string): string {
    const scenarioRegex = new RegExp(`\\s*@.*\\n\\s*Scenario:.*${testCaseId}.*\\n[\\s\\S]*?(?=\\n\\s*@|\\n\\s*Scenario:|$)`, 'g');
    
    if (scenarioRegex.test(featureContent)) {
      return featureContent.replace(scenarioRegex, updatedScenario);
    }
    
    // If scenario not found, add it
    return this.addScenarioToFeature(featureContent, updatedScenario);
  }

  private removeScenarioFromFeature(featureContent: string, testCaseId: string): string {
    const scenarioRegex = new RegExp(`\\s*@.*\\n\\s*Scenario:.*${testCaseId}.*\\n[\\s\\S]*?(?=\\n\\s*@|\\n\\s*Scenario:|$)`, 'g');
    return featureContent.replace(scenarioRegex, '');
  }
} 