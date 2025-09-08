import { Injectable, Logger } from '@nestjs/common';
import { TestCase } from '../entities/test-case.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../../projects/project.entity';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Feature File Manager Service
 *
 * This service provides comprehensive management of Gherkin feature files for test cases.
 * It handles reading, writing, updating, and removing test case scenarios from feature files,
 * ensuring proper formatting and structure according to Gherkin standards.
 *
 * @class FeatureFileManagerService
 * @since 1.0.0
 */
@Injectable()
export class FeatureFileManagerService {
  private readonly logger = new Logger(FeatureFileManagerService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  /**
   * Adds a test case scenario to the corresponding feature file.
   *
   * This method reads the existing feature file, generates a new scenario from the test case,
   * appends it to the file content, and writes the updated content back to the file.
   *
   * @param projectId - The ID of the project containing the test case
   * @param section - The section/category name for the feature file
   * @param entityName - The entity name for the feature file
   * @param testCase - The test case entity to add to the feature file
   * @returns Promise that resolves when the test case is added to the feature file
   * @throws Error when file operations fail or test case cannot be added
   *
   * @example
   * ```typescript
   * await service.addTestCaseToFeature('project-123', 'ecommerce', 'Product', testCase);
   * ```
   */
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
   * Gets the highest numeric suffix from test case tags in the feature file.
   *
   * This method searches for all @TC-{section}-{entity}-{NN} tags in the feature file
   * and returns the highest numeric suffix found. This is used to generate the next
   * sequential test case ID.
   *
   * @param projectId - The ID of the project containing the feature file
   * @param section - The section/category name to search for
   * @param entityName - The entity name to search for
   * @returns Promise resolving to the highest numeric suffix found, or 0 if none found
   *
   * @example
   * ```typescript
   * const maxNumber = await service.getMaxNumberFromFeature('project-123', 'ecommerce', 'Product');
   * // Returns 5 if @TC-ecommerce-Product-05 is the highest found
   * ```
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

  /**
   * Updates an existing test case scenario in the feature file.
   *
   * This method reads the existing feature file, finds the test case scenario by ID,
   * replaces it with the updated scenario content, and writes the updated content back.
   *
   * @param projectId - The ID of the project containing the test case
   * @param section - The section/category name for the feature file
   * @param entityName - The entity name for the feature file
   * @param testCase - The updated test case entity
   * @returns Promise that resolves when the test case is updated in the feature file
   * @throws Error when file operations fail or test case cannot be updated
   *
   * @example
   * ```typescript
   * await service.updateTestCaseInFeature('project-123', 'ecommerce', 'Product', updatedTestCase);
   * ```
   */
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

  /**
   * Removes a test case scenario from the feature file.
   *
   * This method reads the existing feature file, finds the test case scenario by ID,
   * removes it from the content, and writes the updated content back to the file.
   *
   * @param projectId - The ID of the project containing the test case
   * @param section - The section/category name for the feature file
   * @param entityName - The entity name for the feature file
   * @param testCase - The test case entity to remove from the feature file
   * @returns Promise that resolves when the test case is removed from the feature file
   * @throws Error when file operations fail or test case cannot be removed
   *
   * @example
   * ```typescript
   * await service.removeTestCaseFromFeature('project-123', 'ecommerce', 'Product', testCase);
   * ```
   */
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

  /**
   * Gets the file path for a feature file based on project, section, and entity.
   *
   * This private method retrieves the project from the database and constructs
   * the full path to the feature file using the project's path.
   *
   * @private
   * @param projectId - The ID of the project
   * @param section - The section/category name
   * @param entityName - The entity name
   * @returns Promise resolving to the full file path of the feature file
   * @throws Error when project is not found
   */
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

  /**
   * Reads the content of a feature file.
   *
   * This private method reads the feature file content from the filesystem.
   * If the file doesn't exist, it returns a basic feature structure.
   *
   * @private
   * @param filePath - The path to the feature file
   * @returns Promise resolving to the file content or basic structure if file doesn't exist
   * @throws Error when file read operations fail (except ENOENT)
   */
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

  /**
   * Writes content to a feature file.
   *
   * This private method ensures the directory exists and writes the content
   * to the feature file at the specified path.
   *
   * @private
   * @param filePath - The path where to write the feature file
   * @param content - The content to write to the file
   * @returns Promise that resolves when the file is written successfully
   * @throws Error when directory creation or file write operations fail
   */
  private async writeFeatureFile(filePath: string, content: string): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * Creates a basic feature file structure.
   *
   * This private method returns a basic Gherkin feature file structure
   * with a feature description and background steps.
   *
   * @private
   * @returns Basic feature file content as a string
   */
  private createBasicFeatureStructure(): string {
    return `Feature: API Testing

  Background:
    Given I have a valid API client
    And I am authenticated

`;
  }

  /**
   * Generates a Gherkin scenario from a test case entity.
   *
   * This private method converts a TestCase entity into properly formatted
   * Gherkin scenario content with tags, scenario name, and indented steps.
   *
   * @private
   * @param testCase - The test case entity to convert to Gherkin format
   * @returns Formatted Gherkin scenario content as a string
   */
  private generateScenarioFromTestCase(testCase: TestCase): string {
    // Generate the scenario with the correct feature file structure
    const tags = testCase.tags.map(tag => tag.startsWith('@') ? tag : `@${tag}`).join(' ');
    const scenarioName = testCase.name;
    
    // Structure according to the new template: line with @TC-{id}, lines with other tags, line with Scenario, scenario content
    const scenarioLines = testCase.scenario.split('\n');
    const indentedSteps = scenarioLines.map(line => `    ${line}`).join('\n');
    
    // Generate only the scenario content with tags on separate line
    const scenarioContent = `  @${testCase.testCaseId}\n  ${tags}\n  Scenario: ${scenarioName}\n${indentedSteps}`;
    
    // Debug: verify the generated format
    this.logger.log(`Generated scenario content: ${scenarioContent.substring(0, 100)}...`);
    
    return scenarioContent;
  }

  /**
   * Adds a new scenario to existing feature file content.
   *
   * This private method appends a new scenario to the existing feature content,
   * ensuring proper formatting with newlines and spacing.
   *
   * @private
   * @param featureContent - The existing feature file content
   * @param newScenario - The new scenario content to add
   * @returns Updated feature content with the new scenario appended
   */
  private addScenarioToFeature(featureContent: string, newScenario: string): string {
    let content = featureContent;
    // Ensure file ends with a newline
    if (!content.endsWith('\n')) content += '\n';
    // Ensure a blank line before the new scenario for readability
    content += '\n';
    return content + newScenario;
  }

  /**
   * Updates an existing scenario in feature file content.
   *
   * This private method finds and replaces an existing test case scenario
   * in the feature content, or adds it if not found.
   *
   * @private
   * @param featureContent - The existing feature file content
   * @param testCaseId - The ID of the test case to update
   * @param updatedScenario - The updated scenario content
   * @returns Updated feature content with the modified scenario
   */
  private updateScenarioInFeature(featureContent: string, testCaseId: string, updatedScenario: string): string {
    // Search for the specific test case tag (e.g., @TC-ecommerce-Product-7)
    const escapedTestCaseId = testCaseId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Search for the exact test case ID line
    const testCaseIdLineRegex = new RegExp(
      `(\\n\\s*@${escapedTestCaseId})`,
      'g'
    );
    
    if (testCaseIdLineRegex.test(featureContent)) {
      // Extract only the scenario content without the test case ID
      const scenarioLines = updatedScenario.split('\n');
      // Skip the first line (test case ID) and keep the rest with correct format
      const scenarioContent = scenarioLines.slice(1).join('\n'); // This includes tags on separate line
      
      // Search from the test case ID until the next test case ID or end of file
      const fullScenarioRegex = new RegExp(
        `(\\n\\s*@${escapedTestCaseId})[\\s\\S]*?(?=\\n\\s*@TC-|\\n\\s*Feature:|$)`,
        'g'
      );
      
      // Replace keeping the original test case ID and adding the new content
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

  /**
   * Removes a scenario from feature file content.
   *
   * This private method finds and removes a test case scenario from the
   * feature content using regex pattern matching.
   *
   * @private
   * @param featureContent - The existing feature file content
   * @param testCaseId - The ID of the test case to remove
   * @returns Updated feature content with the scenario removed
   */
  private removeScenarioFromFeature(featureContent: string, testCaseId: string): string {
    // Search for the specific test case tag (e.g., @TC-ecommerce-Product-7)
    const escapedTestCaseId = testCaseId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Regex that searches from the line containing @TC-{testCaseId} until the next @TC- or end of file
    // Structure: line with @TC-{id}, lines with other tags, line with Scenario, scenario content
    const scenarioRegex = new RegExp(
      `\\n\\s*@${escapedTestCaseId}\\s*\\n[\\s\\S]*?(?=\\n\\s*@TC-|\\n\\s*Feature:|$)`,
      'g'
    );
    
    // Debug: verify if the regex finds anything
    const matches = featureContent.match(scenarioRegex);
    this.logger.log(`Found ${matches ? matches.length : 0} matches for test case ${testCaseId}`);
    if (matches) {
      this.logger.log(`Match found: ${matches[0].substring(0, 200)}...`);
      this.logger.log(`Match length: ${matches[0].length}`);
    } else {
      this.logger.warn(`No matches found for test case ${testCaseId}`);
      // Try with a simpler regex for debugging
      const simpleRegex = new RegExp(`@${escapedTestCaseId}`, 'g');
      const simpleMatches = featureContent.match(simpleRegex);
      this.logger.log(`Simple search found ${simpleMatches ? simpleMatches.length : 0} matches for ${testCaseId}`);
    }
    
    const updatedContent = featureContent.replace(scenarioRegex, '');
    
    // Log for debugging
    this.logger.log(`Removing test case ${testCaseId} from feature file`);
    this.logger.log(`Original content length: ${featureContent.length}`);
    this.logger.log(`Updated content length: ${updatedContent.length}`);
    
    return updatedContent;
  }
} 