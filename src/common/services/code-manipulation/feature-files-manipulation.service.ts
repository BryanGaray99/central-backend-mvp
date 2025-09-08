import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { CodeInsertion } from '../../../modules/ai/interfaces/ai-agent.interface';

/**
 * Feature Files Manipulation Service
 * 
 * Handles manipulation of Gherkin feature files for test case generation.
 * Provides functionality to analyze feature files, find insertion points,
 * validate scenarios, and manage feature file content with comprehensive
 * logging and error handling.
 * 
 * @class FeatureFilesManipulationService
 */
@Injectable()
export class FeatureFilesManipulationService {
  private readonly logger = new Logger(FeatureFilesManipulationService.name);

  /**
   * Analyzes feature file and finds the location to insert new code.
   * 
   * @param filePath - Path to the feature file to analyze
   * @param newFeatureCode - The new feature code to insert
   * @param generationId - Unique identifier for the generation process
   * @returns Code insertion object with file path, line number, and content, or null if insertion is not possible
   * 
   * @example
   * ```typescript
   * const insertion = await featureService.analyzeFeatureFile(
   *   'src/features/user.feature',
   *   '@TC-001\nScenario: Login test',
   *   'gen-123'
   * );
   * if (insertion) {
   *   console.log(`Insert at line ${insertion.line}`);
   * }
   * ```
   */
  async analyzeFeatureFile(
    filePath: string, 
    newFeatureCode: string, 
    generationId: string
  ): Promise<CodeInsertion | null> {
    this.logger.log(`🔍 [${generationId}] Analyzing feature file: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      this.logger.log(`⚠️ [${generationId}] Feature file does not exist: ${filePath}`);
      return null;
    }
    
    this.logger.log(`📄 [${generationId}] Feature file found, reading content...`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    this.logger.log(`📊 [${generationId}] Feature file has ${lines.length} lines`);
    
    // Extract test case ID from new code to verify if it already exists
    const tcIdMatch = newFeatureCode.match(/@TC-[^\s]+/);
    if (tcIdMatch) {
      const testCaseId = tcIdMatch[0];
      this.logger.log(`🔍 [${generationId}] Verifying if test case ${testCaseId} already exists...`);
      
      if (content.includes(testCaseId)) {
        this.logger.warn(`⚠️ [${generationId}] Test case ${testCaseId} already exists in file. Will not insert.`);
        return null; // Don't insert if it already exists
      }
    }
    
    // Find the last scenario
    const lastScenarioLine = this.findLastScenarioLine(lines, generationId);
    
    // If no scenarios, search after Background or at end of file
    let insertLine = lines.length;
    if (lastScenarioLine >= 0) {
      // Insert after the last scenario
      insertLine = lastScenarioLine + 1;
      this.logger.log(`📍 [${generationId}] Starting search from line ${insertLine + 1} (after last Scenario)`);
      
      // Advance until finding an empty line or the end
      while (insertLine < lines.length && lines[insertLine].trim() !== '') {
        this.logger.log(`🔍 [${generationId}] Line ${insertLine + 1}: "${lines[insertLine].trim()}" (not empty, continuing...)`);
        insertLine++;
      }
      this.logger.log(`✅ [${generationId}] Found empty line or end at line ${insertLine + 1}`);
    } else {
      // Search after Background
      insertLine = this.findInsertionAfterBackground(lines, generationId);
    }
    
    this.logger.log(`📍 [${generationId}] FINAL INSERTION LINE: ${insertLine + 1}`);
    this.logger.log(`📍 [${generationId}] Content to insert: ${newFeatureCode.substring(0, 100)}...`);
    
    return {
      file: filePath,
      line: insertLine + 1, // 1-indexed
      content: '\n' + newFeatureCode,
      type: 'scenario',
      description: 'Insert new scenario after the last existing one',
    };
  }

  /**
   * Finds the last scenario in the feature file.
   * 
   * @private
   * @param lines - Array of file lines to search
   * @param generationId - Unique identifier for the generation process
   * @returns Line number of the last scenario (0-indexed) or -1 if not found
   */
  private findLastScenarioLine(lines: string[], generationId: string): number {
    let lastScenarioLine = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().startsWith('Scenario:')) {
        lastScenarioLine = i;
        this.logger.log(`🎯 [${generationId}] Last Scenario found at line ${i + 1}: "${lines[i].trim()}"`);
        break;
      }
    }
    
    if (lastScenarioLine === -1) {
      this.logger.log(`⚠️ [${generationId}] No scenarios found in file`);
    }
    
    return lastScenarioLine;
  }

  /**
   * Finds the insertion line after the Background section.
   * 
   * @private
   * @param lines - Array of file lines to search
   * @param generationId - Unique identifier for the generation process
   * @returns Line number where to insert after Background (0-indexed)
   */
  private findInsertionAfterBackground(lines: string[], generationId: string): number {
    this.logger.log(`🔍 [${generationId}] Searching for Background...`);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('Background:')) {
        this.logger.log(`🎯 [${generationId}] Background found at line ${i + 1}`);
        let insertLine = i + 1;
        while (insertLine < lines.length && lines[insertLine].trim() !== '') {
          this.logger.log(`🔍 [${generationId}] Line ${insertLine + 1}: "${lines[insertLine].trim()}" (not empty, continuing...)`);
          insertLine++;
        }
        this.logger.log(`✅ [${generationId}] Found empty line after Background at line ${insertLine + 1}`);
        return insertLine;
      }
    }
    
    // If no Background, insert at the end
    return lines.length;
  }

  /**
   * Checks if a scenario already exists in the file.
   * 
   * @param filePath - Path to the feature file to check
   * @param scenarioName - Name of the scenario to search for
   * @returns True if the scenario exists, false otherwise
   * 
   * @example
   * ```typescript
   * const exists = featureService.scenarioExists('user.feature', 'Login test');
   * if (exists) {
   *   console.log('Scenario already exists');
   * }
   * ```
   */
  scenarioExists(filePath: string, scenarioName: string): boolean {
    if (!fs.existsSync(filePath)) {
      return false;
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.trim().includes(scenarioName)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Gets the content of the feature file.
   * 
   * @param filePath - Path to the feature file
   * @returns File content as string or null if file doesn't exist
   * 
   * @example
   * ```typescript
   * const content = featureService.getFeatureContent('user.feature');
   * if (content) {
   *   console.log('File content:', content);
   * }
   * ```
   */
  getFeatureContent(filePath: string): string | null {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * Writes content to the feature file.
   * 
   * @param filePath - Path to the feature file
   * @param content - Content to write to the file
   * 
   * @example
   * ```typescript
   * featureService.writeFeatureContent('user.feature', 'Feature: User management');
   * ```
   */
  writeFeatureContent(filePath: string, content: string): void {
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * Finds all scenarios in the feature file.
   * 
   * @param filePath - Path to the feature file to search
   * @returns Array of scenario objects with line number and name
   * 
   * @example
   * ```typescript
   * const scenarios = featureService.findAllScenarios('user.feature');
   * scenarios.forEach(scenario => {
   *   console.log(`Scenario "${scenario.name}" at line ${scenario.line}`);
   * });
   * ```
   */
  findAllScenarios(filePath: string): Array<{ line: number; name: string }> {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const scenarios: Array<{ line: number; name: string }> = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('Scenario:')) {
        const name = line.replace('Scenario:', '').trim();
        scenarios.push({ line: i + 1, name });
      }
    }
    
    return scenarios;
  }

  /**
   * Finds the Background section in the feature file.
   * 
   * @param filePath - Path to the feature file to search
   * @returns Background object with line number and content, or null if not found
   * 
   * @example
   * ```typescript
   * const background = featureService.findBackground('user.feature');
   * if (background) {
   *   console.log(`Background found at line ${background.line}: ${background.content}`);
   * }
   * ```
   */
  findBackground(filePath: string): { line: number; content: string } | null {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('Background:')) {
        return { line: i + 1, content: lines[i].trim() };
      }
    }
    
    return null;
  }

  /**
   * Validates the structure of the feature file.
   * 
   * @param filePath - Path to the feature file to validate
   * @returns Validation result with success status and error messages
   * 
   * @example
   * ```typescript
   * const validation = featureService.validateFeatureStructure('user.feature');
   * if (!validation.isValid) {
   *   console.log('Validation errors:', validation.errors);
   * }
   * ```
   */
  validateFeatureStructure(filePath: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!fs.existsSync(filePath)) {
      errors.push('File does not exist');
      return { isValid: false, errors };
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    let hasFeature = false;
    let hasBackground = false;
    let hasScenarios = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('Feature:')) {
        hasFeature = true;
      } else if (trimmedLine.startsWith('Background:')) {
        hasBackground = true;
      } else if (trimmedLine.startsWith('Scenario:')) {
        hasScenarios = true;
      }
    }
    
    if (!hasFeature) {
      errors.push('Feature declaration not found');
    }
    
    if (!hasScenarios) {
      errors.push('No scenarios found');
    }
    
    return { isValid: errors.length === 0, errors };
  }
} 