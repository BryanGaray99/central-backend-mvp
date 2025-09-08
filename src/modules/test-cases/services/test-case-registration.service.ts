import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestCase, TestCaseStatus, TestType } from '../entities/test-case.entity';
import { Project } from '../../projects/project.entity';
import { RegisterEndpointDto } from '../../endpoints/dto/register-endpoint.dto';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Test Case Registration Service
 *
 * This service handles the registration of test cases from feature files.
 * It processes Gherkin feature files, extracts test case scenarios, and
 * registers them in the database with proper test case IDs and metadata.
 *
 * @class TestCaseRegistrationService
 * @since 1.0.0
 */
@Injectable()
export class TestCaseRegistrationService {
  private readonly logger = new Logger(TestCaseRegistrationService.name);

  constructor(
    @InjectRepository(TestCase)
    private readonly testCaseRepository: Repository<TestCase>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  /**
   * Gets the next available test case number for a given project, section, and entity.
   *
   * This method searches for existing test cases with the pattern TC-{SECTION}-{ENTITYNAME}-{NUMBER}
   * and returns the next sequential number to use for a new test case.
   *
   * @param projectId - The ID of the project
   * @param section - The section/category name
   * @param entityName - The entity name
   * @returns Promise resolving to the next available test case number
   *
   * @example
   * ```typescript
   * const nextNumber = await service.getNextTestCaseNumber('project-123', 'ecommerce', 'Product');
   * // Returns 6 if TC-ECOMMERCE-PRODUCT-5 is the highest existing number
   * ```
   */
  async getNextTestCaseNumber(projectId: string, section: string, entityName: string): Promise<number> {
    // Search for the correct pattern: TC-{SECTION}-{ENTITYNAME}-{NUMBER}
    const pattern = `TC-${section.toUpperCase()}-${entityName.toUpperCase()}-`;
    const testCases = await this.testCaseRepository
      .createQueryBuilder('testCase')
      .where('testCase.projectId = :projectId', { projectId })
      .andWhere('testCase.testCaseId LIKE :pattern', { pattern: `${pattern}%` })
      .getMany();
    let maxNumber = 0;
    for (const tc of testCases) {
      const match = tc.testCaseId.match(new RegExp(`${pattern}(\\d+)`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) maxNumber = num;
      }
    }
    return maxNumber + 1;
  }

  /**
   * Processes a feature file and registers all test cases found in it.
   *
   * This method reads a Gherkin feature file, extracts test case scenarios,
   * and registers each one in the database with proper test case IDs and metadata.
   *
   * @param projectId - The ID of the project
   * @param section - The section/category name
   * @param entityName - The entity name
   * @param dto - The endpoint registration data for context
   * @returns Promise that resolves when all test cases are registered
   * @throws Error when file processing or database operations fail
   *
   * @example
   * ```typescript
   * await service.processFeatureFileAndRegisterTestCases('project-123', 'ecommerce', 'Product', endpointDto);
   * ```
   */
  async processFeatureFileAndRegisterTestCases(
    projectId: string,
    section: string,
    entityName: string,
    dto: RegisterEndpointDto,
  ): Promise<void> {
    try {
      const project = await this.projectRepository.findOne({ where: { id: projectId } });
      if (!project) throw new Error(`Project with ID ${projectId} not found`);
      const featureFilePath = path.join(
        project.path,
        'src',
        'features',
        section,
        `${entityName.toLowerCase()}.feature`
      );
      let featureContent = await fs.readFile(featureFilePath, 'utf-8');
      const lines = featureContent.split('\n');
      const tagPattern = `@TC-${section}-${entityName}-Number`;
      let currentNumber = await this.getNextTestCaseNumber(projectId, section, entityName);
      let replacements: { lineIdx: number, scenarioName: string, testCaseId: string, tags: string[], steps: string }[] = [];

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(tagPattern)) {

          const tags = this.extractTagsForScenario(lines, i);
          
          let scenarioName = '';
          let steps = '';
          let found = false;
          

          for (let j = i + 1; j < lines.length; j++) {
            const nextLine = lines[j].trim();
            if (nextLine.startsWith('Scenario:') || nextLine.startsWith('Scenario Outline:')) {
              scenarioName = nextLine.replace('Scenario:', '').replace('Scenario Outline:', '').trim();
              found = true;
              
              // Extract steps from the next line until the next scenario or end of file
              steps = this.extractStepsFromScenario(lines, j + 1);
              break;
            }
            if (nextLine.startsWith('@') || nextLine === '') continue;
          }
          
          // If not found, try searching backwards (in case it's the last one in the file)
          if (!found && i < lines.length - 1) {
            for (let j = i + 1; j < lines.length; j++) {
              if (lines[j].trim() !== '' && !lines[j].trim().startsWith('@')) {
                scenarioName = lines[j].trim();
                steps = this.extractStepsFromScenario(lines, j + 1);
                found = true;
                break;
              }
            }
          }
          
          if (!found) {
            this.logger.warn(`[REGISTRATION] Scenario name not found after tag on line ${i + 1}`);
          }
          
          if (scenarioName) {
            // 1. FIRST: Replace "Number" with the real number in the feature file
            lines[i] = lines[i].replace(tagPattern, `@TC-${section}-${entityName}-${currentNumber}`);
            
            // 2. SECOND: Extract the real testCaseId from the file to save in database
            const testCaseId = `TC-${section}-${entityName}-${currentNumber}`;
            
            this.logger.log(`Found test case: ${testCaseId} - "${scenarioName}"`);
            
            replacements.push({ 
              lineIdx: i, 
              scenarioName, 
              testCaseId, // Use the testCaseId extracted from the file
              tags, 
              steps 
            });
            currentNumber++;
          }
        }
      }
      
      await fs.writeFile(featureFilePath, lines.join('\n'), 'utf-8');
//     this.logger.log(`Feature file actualizado con tags reemplazados: ${featureFilePath}`);

      for (const rep of replacements) {
        const method = this.determineMethodFromScenario(rep.scenarioName, dto.methods);
        this.logger.log(`Creating test case: ${rep.testCaseId} - ${rep.scenarioName} - Method: ${method}`);
        await this.createTestCaseFromScenario(
          projectId,
          section,
          entityName,
          rep.scenarioName,
          method,
          rep.testCaseId, // Use the extracted testCaseId
          rep.tags,
          rep.steps
        );
      }
//     this.logger.log(`Total de test cases registrados: ${replacements.length}`);
    } catch (error) {
      this.logger.error(`Error processing feature file:`, error);
      throw error;
    }
  }

  /**
   * Extracts tags for a test case scenario from feature file lines.
   *
   * This private method searches for Gherkin tags around a test case tag line,
   * both upwards and downwards, and returns all relevant tags excluding
   * the test case numbering tag.
   *
   * @private
   * @param lines - Array of feature file lines
   * @param tagLineIndex - The index of the line containing the test case tag
   * @returns Array of tag strings found for the scenario
   */
  private extractTagsForScenario(lines: string[], tagLineIndex: number): string[] {
    const tags: string[] = [];

    const extractTokens = (line: string): string[] => {
      // Supports spaces and commas as separators; ignores the numbering tag @TC-
      return line
        .split(/[,\s]+/)
        .map(t => t.trim())
        .filter(t => t && t.startsWith('@') && !/^@TC-/i.test(t));
    };
    
    // Search for tags upwards from the TC tag line
    for (let i = tagLineIndex; i >= 0; i--) {
      const line = lines[i].trim();
      if (line === '') break; // Empty line marks the end of tags
      if (line.startsWith('@')) {
        const tokens = extractTokens(line);
        for (let k = tokens.length - 1; k >= 0; k--) {
          tags.unshift(tokens[k]);
        }
      } else if (!line.startsWith('Feature:') && !line.startsWith('Background:')) {
        break; 
      }
    }
    
    // Search for tags downwards from the TC tag line (new template structure)
    for (let i = tagLineIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') break; // Empty line marks the end of tags
      if (line.startsWith('Scenario:') || line.startsWith('Scenario Outline:')) {
        break; // If we find the scenario, terminate
      }
      if (line.startsWith('@')) {
        const tokens = extractTokens(line);
        tokens.forEach(t => tags.push(t));
      }
    }
    
    return tags;
  }

  /**
   * Extracts step definitions from a test case scenario.
   *
   * This private method processes feature file lines starting from a given index
   * and extracts all step definitions until it encounters another scenario,
   * outline, or end of content.
   *
   * @private
   * @param lines - Array of feature file lines
   * @param startLineIndex - The index to start extracting steps from
   * @returns String containing all step definitions joined by newlines
   */
  private extractStepsFromScenario(lines: string[], startLineIndex: number): string {
    const steps: string[] = [];
    
    for (let i = startLineIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // If we find another scenario, outline, or empty line followed by tag, terminate
      if (line.startsWith('Scenario:') || line.startsWith('Scenario Outline:')) {
        break;
      }
      
      // If we find an empty line followed by a tag, also terminate
      if (line === '' && i + 1 < lines.length && lines[i + 1].trim().startsWith('@')) {
        break;
      }
      
      // If the line is not empty and not a tag, it's a step
      if (line !== '' && !line.startsWith('@')) {
        steps.push(line);
      }
    }
    
    return steps.join('\n');
  }

  /**
   * Determines the HTTP method from a scenario name.
   *
   * This private method analyzes a scenario name to determine the appropriate
   * HTTP method based on keywords in the scenario name.
   *
   * @private
   * @param scenarioName - The name of the test scenario
   * @param methods - Array of available HTTP methods as fallback
   * @returns The determined HTTP method string
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
   * Creates a test case entity from scenario data and saves it to the database.
   *
   * This private method creates a new TestCase entity with the provided scenario
   * information and saves it to the database with proper metadata and status.
   *
   * @private
   * @param projectId - The ID of the project
   * @param section - The section/category name
   * @param entityName - The name of the entity
   * @param scenarioName - The name of the test scenario
   * @param method - The HTTP method for the test case
   * @param testCaseId - The unique identifier for the test case
   * @param tags - Array of tags associated with the test case
   * @param steps - The step definitions for the test case
   * @returns Promise that resolves when the test case is saved to the database
   */
  private async createTestCaseFromScenario(
    projectId: string,
    section: string,
    entityName: string,
    scenarioName: string,
    method: string,
    testCaseId: string, 
    tags: string[],
    steps: string,
  ): Promise<void> {
    const testType = this.determineTestType(scenarioName);
    
    this.logger.log(`Saving to database: ${testCaseId} - ${scenarioName} - tags: ${tags.join(', ')} - type: ${testType}`);
//     this.logger.log(`Steps to save: ${steps.split('\n').length} lines`);
    
    const testCase = this.testCaseRepository.create({
      testCaseId, // Use the testCaseId extracted from the file
      projectId,
      entityName,
      section,
      name: scenarioName,
      description: `Automatically generated test case for ${entityName} ${method} operation`,
      tags,
      method,
      testType,
      scenario: steps, 
      status: TestCaseStatus.ACTIVE,
    });
    await this.testCaseRepository.save(testCase);
  }

  /**
   * Determines the test type from a scenario name.
   *
   * This private method analyzes a scenario name to determine whether it's
   * a positive or negative test case based on keywords in the scenario name.
   *
   * @private
   * @param scenarioName - The name of the test scenario
   * @returns The determined test type (POSITIVE or NEGATIVE)
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