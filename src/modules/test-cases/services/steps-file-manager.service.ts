import { Injectable, Logger } from '@nestjs/common';
import { TestStep } from '../entities/test-step.entity';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class StepsFileManagerService {
  private readonly logger = new Logger(StepsFileManagerService.name);

  async addStepToFile(projectId: string, step: TestStep): Promise<void> {
    try {
      const stepsPath = this.getStepsFilePath(projectId);
      const stepsContent = await this.readStepsFile(stepsPath);
      
      const newStepDefinition = this.generateStepDefinition(step);
      const updatedContent = this.addStepToFileContent(stepsContent, newStepDefinition);
      
      await this.writeStepsFile(stepsPath, updatedContent);
      
      this.logger.log(`Added step ${step.stepId} to steps file: ${stepsPath}`);
    } catch (error) {
      this.logger.error(`Error adding step to file: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateStepInFile(step: TestStep): Promise<void> {
    try {
      const stepsPath = this.getStepsFilePath(step.projectId);
      const stepsContent = await this.readStepsFile(stepsPath);
      
      const updatedStepDefinition = this.generateStepDefinition(step);
      const updatedContent = this.updateStepInFileContent(stepsContent, step.stepId, updatedStepDefinition);
      
      await this.writeStepsFile(stepsPath, updatedContent);
      
      this.logger.log(`Updated step ${step.stepId} in steps file: ${stepsPath}`);
    } catch (error) {
      this.logger.error(`Error updating step in file: ${error.message}`, error.stack);
      throw error;
    }
  }

  async removeStepFromFile(step: TestStep): Promise<void> {
    try {
      const stepsPath = this.getStepsFilePath(step.projectId);
      const stepsContent = await this.readStepsFile(stepsPath);
      
      const updatedContent = this.removeStepFromFileContent(stepsContent, step.stepId);
      
      await this.writeStepsFile(stepsPath, updatedContent);
      
      this.logger.log(`Removed step ${step.stepId} from steps file: ${stepsPath}`);
    } catch (error) {
      this.logger.error(`Error removing step from file: ${error.message}`, error.stack);
      throw error;
    }
  }

  async generateStepsFile(projectId: string, steps: TestStep[]): Promise<string> {
    try {
      const stepsPath = this.getStepsFilePath(projectId);
      let content = this.createBasicStepsStructure();
      
      for (const step of steps) {
        const stepDefinition = this.generateStepDefinition(step);
        content = this.addStepToFileContent(content, stepDefinition);
      }
      
      await this.writeStepsFile(stepsPath, content);
      
      this.logger.log(`Generated steps file for project ${projectId}: ${stepsPath}`);
      return content;
    } catch (error) {
      this.logger.error(`Error generating steps file: ${error.message}`, error.stack);
      throw error;
    }
  }

  private getStepsFilePath(projectId: string): string {
    return path.join(process.cwd(), 'projects', projectId, 'steps', 'api-steps.ts');
  }

  private async readStepsFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, create basic structure
        return this.createBasicStepsStructure();
      }
      throw error;
    }
  }

  private async writeStepsFile(filePath: string, content: string): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(filePath, content, 'utf-8');
  }

  private createBasicStepsStructure(): string {
    return `import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

// API Client setup
let apiClient: any;
let lastResponse: any;
let testData: any;

Given('I have a valid API client', async function() {
  // Initialize API client
  apiClient = this.getApiClient();
});

Given('I am authenticated', async function() {
  // Authentication logic
  await apiClient.authenticate();
});

`;
  }

  private generateStepDefinition(step: TestStep): string {
    const stepKeyword = this.getStepKeyword(step.type);
    const stepPattern = this.generateStepPattern(step.definition, step.parameters);
    const stepImplementation = this.generateStepImplementation(step);
    
    return `
${stepKeyword}('${stepPattern}', async function(${this.generateParametersSignature(step.parameters)}) {
  ${stepImplementation}
});

`;
  }

  private getStepKeyword(stepType: string): string {
    switch (stepType.toLowerCase()) {
      case 'given':
        return 'Given';
      case 'when':
        return 'When';
      case 'then':
        return 'Then';
      default:
        return 'Given';
    }
  }

  private generateStepPattern(definition: string, parameters: any[]): string {
    let pattern = definition;
    
    for (const param of parameters) {
      const placeholder = `{${param.name}}`;
      const regexPattern = `([^\\s]+)`;
      pattern = pattern.replace(placeholder, regexPattern);
    }
    
    return pattern;
  }

  private generateParametersSignature(parameters: any[]): string {
    if (!parameters || parameters.length === 0) {
      return '';
    }
    
    return parameters.map(param => param.name).join(', ');
  }

  private generateStepImplementation(step: TestStep): string {
    if (step.stepType === 'custom') {
      return step.implementation;
    }
    
    // Generate standard implementation based on step type
    switch (step.type.toLowerCase()) {
      case 'given':
        return this.generateGivenImplementation(step);
      case 'when':
        return this.generateWhenImplementation(step);
      case 'then':
        return this.generateThenImplementation(step);
      default:
        return step.implementation;
    }
  }

  private generateGivenImplementation(step: TestStep): string {
    if (step.definition.includes('valid') && step.definition.includes('data')) {
      return `
  // Setup test data
  testData = this.generateTestData();
  this.setTestData(testData);`;
    }
    
    if (step.definition.includes('authenticated')) {
      return `
  // Ensure authentication
  await apiClient.ensureAuthentication();`;
    }
    
    return step.implementation;
  }

  private generateWhenImplementation(step: TestStep): string {
    if (step.definition.includes('create')) {
      return `
  // Create resource
  lastResponse = await apiClient.create(testData);
  this.setLastResponse(lastResponse);`;
    }
    
    if (step.definition.includes('get') || step.definition.includes('read')) {
      return `
  // Get resource
  lastResponse = await apiClient.get(testData.id);
  this.setLastResponse(lastResponse);`;
    }
    
    if (step.definition.includes('update')) {
      return `
  // Update resource
  lastResponse = await apiClient.update(testData.id, testData);
  this.setLastResponse(lastResponse);`;
    }
    
    if (step.definition.includes('delete')) {
      return `
  // Delete resource
  lastResponse = await apiClient.delete(testData.id);
  this.setLastResponse(lastResponse);`;
    }
    
    return step.implementation;
  }

  private generateThenImplementation(step: TestStep): string {
    if (step.definition.includes('created successfully')) {
      return `
  // Verify creation
  expect(lastResponse.status).toBe(201);
  expect(lastResponse.data).toBeDefined();
  expect(lastResponse.data.id).toBeDefined();`;
    }
    
    if (step.definition.includes('retrieved successfully')) {
      return `
  // Verify retrieval
  expect(lastResponse.status).toBe(200);
  expect(lastResponse.data).toBeDefined();`;
    }
    
    if (step.definition.includes('updated successfully')) {
      return `
  // Verify update
  expect(lastResponse.status).toBe(200);
  expect(lastResponse.data).toBeDefined();`;
    }
    
    if (step.definition.includes('deleted successfully')) {
      return `
  // Verify deletion
  expect(lastResponse.status).toBe(204);`;
    }
    
    if (step.definition.includes('error')) {
      return `
  // Verify error response
  expect(lastResponse.status).toBeGreaterThanOrEqual(400);
  expect(lastResponse.data.error).toBeDefined();`;
    }
    
    return step.implementation;
  }

  private addStepToFileContent(content: string, newStepDefinition: string): string {
    return content + newStepDefinition;
  }

  private updateStepInFileContent(content: string, stepId: string, updatedStepDefinition: string): string {
    const stepRegex = new RegExp(`\\n\\s*Given\\('.*${stepId}.*\\n[\\s\\S]*?\\n\\);\\n`, 'g');
    
    if (stepRegex.test(content)) {
      return content.replace(stepRegex, updatedStepDefinition);
    }
    
    // If step not found, add it
    return this.addStepToFileContent(content, updatedStepDefinition);
  }

  private removeStepFromFileContent(content: string, stepId: string): string {
    const stepRegex = new RegExp(`\\n\\s*Given\\('.*${stepId}.*\\n[\\s\\S]*?\\n\\);\\n`, 'g');
    return content.replace(stepRegex, '');
  }
} 