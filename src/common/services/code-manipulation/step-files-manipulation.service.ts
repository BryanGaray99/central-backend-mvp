import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { CodeInsertion } from '../../../modules/ai/interfaces/ai-agent.interface';

/**
 * Step Files Manipulation Service
 * 
 * Handles manipulation of step definition files for test case generation.
 * Provides functionality to analyze step files, find insertion points using
 * section comments, parse step blocks, and manage step definitions with
 * comprehensive logging and duplicate detection.
 * 
 * @class StepFilesManipulationService
 */
@Injectable()
export class StepFilesManipulationService {
  private readonly logger = new Logger(StepFilesManipulationService.name);

  /**
   * Analyzes step file and finds locations to insert using section comments.
   * 
   * @param filePath - Path to the step file to analyze
   * @param newStepsCode - The new step code to insert
   * @param generationId - Unique identifier for the generation process
   * @returns Array of code insertions for Given, When, and Then steps
   * 
   * @example
   * ```typescript
   * const insertions = await stepService.analyzeStepsFile(
   *   'src/steps/user.steps.ts',
   *   'Given("user is logged in", () => {})',
   *   'gen-123'
   * );
   * console.log(`Found ${insertions.length} insertion points`);
   * ```
   */
  async analyzeStepsFile(
    filePath: string, 
    newStepsCode: string, 
    generationId: string
  ): Promise<CodeInsertion[]> {
    this.logger.log(`🔍 [${generationId}] Analyzing step file: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      this.logger.log(`⚠️ [${generationId}] Step file does not exist: ${filePath}`);
      return [];
    }
    
    this.logger.log(`📄 [${generationId}] Step file found, reading content...`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    this.logger.log(`📊 [${generationId}] Step file has ${lines.length} lines`);
    
    // Search for section comments
    const sectionComments = this.findSectionComments(lines, generationId);
    
    const insertions: CodeInsertion[] = [];
    
    // Parse step code to separate Given, When, Then
    this.logger.log(`🔍 [${generationId}] Parsing step blocks...`);
    const stepBlocks = this.parseStepBlocks(newStepsCode);
    this.logger.log(`📊 [${generationId}] Blocks found:`);
    this.logger.log(`📊 [${generationId}] - Given: ${stepBlocks.given ? 'YES' : 'NO'}`);
    this.logger.log(`📊 [${generationId}] - When: ${stepBlocks.when ? 'YES' : 'NO'}`);
    this.logger.log(`📊 [${generationId}] - Then: ${stepBlocks.then ? 'YES' : 'NO'}`);
    
    // Insert each block in its corresponding location using comments
    if (stepBlocks.given) {
      this.logger.log(`🔍 [${generationId}] Processing Given insertion...`);
      
      // Check if step already exists
      const stepPattern = stepBlocks.given.match(/Given\(['"`]([^'"`]+)['"`]/)?.[1];
      if (stepPattern && this.stepExists(filePath, stepPattern)) {
        this.logger.warn(`⚠️ [${generationId}] Step already exists: ${stepPattern}`);
        // Don't insert duplicate step
      } else {
        let insertLine = -1;
        
        // Try to use "End of Given steps" marker
        if (sectionComments.givenEndLine >= 0) {
          insertLine = sectionComments.givenEndLine;
          this.logger.log(`📍 [${generationId}] Inserting Given BEFORE comment "// End of Given steps" at line ${insertLine + 1}`);
        } else {
          // Fallback method: find last Given
          const lastGivenLine = this.findLastStepOfType(lines, 'Given', generationId);
          if (lastGivenLine >= 0) {
            insertLine = lastGivenLine + 1; // Insert after last Given
            this.logger.log(`📍 [${generationId}] Inserting Given after last existing Given at line ${insertLine + 1}`);
          } else {
            // If no Given found, insert at end of file
            insertLine = lines.length;
            this.logger.log(`📍 [${generationId}] No existing Given found, inserting at end of file at line ${insertLine + 1}`);
          }
        }
        
        if (insertLine >= 0) {
          insertions.push({
            file: filePath,
            line: insertLine + 1,
            content: '\n' + stepBlocks.given,
            type: 'step',
            description: 'Insert new Given',
          });
        }
      }
    }
    
    if (stepBlocks.when) {
      this.logger.log(`🔍 [${generationId}] Processing When insertion...`);
      
      // Check if step already exists
      const stepPattern = stepBlocks.when.match(/When\(['"`]([^'"`]+)['"`]/)?.[1];
      if (stepPattern && this.stepExists(filePath, stepPattern)) {
        this.logger.warn(`⚠️ [${generationId}] Step already exists: ${stepPattern}`);
        // Don't insert duplicate step
      } else {
        let insertLine = -1;
        
        // Try to use "End of When steps" marker
        if (sectionComments.whenEndLine >= 0) {
          insertLine = sectionComments.whenEndLine;
          this.logger.log(`📍 [${generationId}] Inserting When BEFORE comment "// End of When steps" at line ${insertLine + 1}`);
        } else {
          // Fallback method: find last When
          const lastWhenLine = this.findLastStepOfType(lines, 'When', generationId);
          if (lastWhenLine >= 0) {
            insertLine = lastWhenLine + 1; // Insert after last When
            this.logger.log(`📍 [${generationId}] Inserting When after last existing When at line ${insertLine + 1}`);
          } else {
            // If no When found, insert at end of file
            insertLine = lines.length;
            this.logger.log(`📍 [${generationId}] No existing When found, inserting at end of file at line ${insertLine + 1}`);
          }
        }
        
        if (insertLine >= 0) {
          insertions.push({
            file: filePath,
            line: insertLine + 1,
            content: '\n' + stepBlocks.when,
            type: 'step',
            description: 'Insert new When',
          });
        }
      }
    }
    
    if (stepBlocks.then) {
      this.logger.log(`🔍 [${generationId}] Processing Then insertion...`);
      
      // Check if step already exists
      const stepPattern = stepBlocks.then.match(/Then\(['"`]([^'"`]+)['"`]/)?.[1];
      if (stepPattern && this.stepExists(filePath, stepPattern)) {
        this.logger.warn(`⚠️ [${generationId}] Step already exists: ${stepPattern}`);
        // Don't insert duplicate step
      } else {
        let insertLine = -1;
        
        // Try to use "End of Then steps" marker
        if (sectionComments.thenCommentLine >= 0) {
          insertLine = sectionComments.thenCommentLine;
          this.logger.log(`📍 [${generationId}] Inserting Then BEFORE comment "// End of Then steps" at line ${insertLine + 1}`);
        } else {
          // Fallback method: find last Then
          const lastThenLine = this.findLastStepOfType(lines, 'Then', generationId);
          if (lastThenLine >= 0) {
            insertLine = lastThenLine + 1; // Insert after last Then
            this.logger.log(`📍 [${generationId}] Inserting Then after last existing Then at line ${insertLine + 1}`);
          } else {
            // If no Then found, insert at end of file
            insertLine = lines.length;
            this.logger.log(`📍 [${generationId}] No existing Then found, inserting at end of file at line ${insertLine + 1}`);
          }
        }
        
        if (insertLine >= 0) {
          insertions.push({
            file: filePath,
            line: insertLine + 1,
            content: '\n' + stepBlocks.then,
            type: 'step',
            description: 'Insert new Then',
          });
        }
      }
    }
    
    this.logger.log(`📊 [${generationId}] Total step insertions: ${insertions.length}`);
    for (let i = 0; i < insertions.length; i++) {
      this.logger.log(`📝 [${generationId}] Insertion ${i + 1}: line ${insertions[i].line} - ${insertions[i].description}`);
    }
    
    return insertions;
  }

  /**
   * Searches for section comments in the step file.
   * 
   * @private
   * @param lines - Array of file lines to search
   * @param generationId - Unique identifier for the generation process
   * @returns Object with line numbers of section comments
   */
  private findSectionComments(
    lines: string[], 
    generationId: string
  ): { whenCommentLine: number; thenCommentLine: number; givenEndLine: number; whenEndLine: number } {
    let whenCommentLine = -1;
    let thenCommentLine = -1;
    let givenEndLine = -1;
    let whenEndLine = -1;
    
    this.logger.log(`🔍 [${generationId}] Searching for section comments...`);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '// Beginning of When steps') {
        whenCommentLine = i;
        this.logger.log(`🎯 [${generationId}] Comment "// Beginning of When steps" found at line ${i + 1}`);
      } else if (line === '// End of Then steps') {
        thenCommentLine = i;
        this.logger.log(`🎯 [${generationId}] Comment "// End of Then steps" found at line ${i + 1}`);
      } else if (line === '// End of Given steps') {
        givenEndLine = i;
        this.logger.log(`🎯 [${generationId}] Comment "// End of Given steps" found at line ${i + 1}`);
      } else if (line === '// End of When steps') {
        whenEndLine = i;
        this.logger.log(`🎯 [${generationId}] Comment "// End of When steps" found at line ${i + 1}`);
      }
    }
    
    this.logger.log(`📊 [${generationId}] Comments found:`);
    this.logger.log(`📊 [${generationId}] - "// Beginning of When steps": line ${whenCommentLine >= 0 ? whenCommentLine + 1 : 'NOT FOUND'}`);
    this.logger.log(`📊 [${generationId}] - "// End of Then steps": line ${thenCommentLine >= 0 ? thenCommentLine + 1 : 'NOT FOUND'}`);
    this.logger.log(`📊 [${generationId}] - "// End of Given steps": line ${givenEndLine >= 0 ? givenEndLine + 1 : 'NOT FOUND'}`);
    this.logger.log(`📊 [${generationId}] - "// End of When steps": line ${whenEndLine >= 0 ? whenEndLine + 1 : 'NOT FOUND'}`);
    
    return { whenCommentLine, thenCommentLine, givenEndLine, whenEndLine };
  }

  /**
   * Encuentra el final de un bloque de step
   */
  findEndOfStepBlock(lines: string[], startLine: number): number {
    let endLine = startLine;
    
    // Avanzar hasta encontrar el final de la función
    while (endLine < lines.length) {
      const line = lines[endLine].trim();
      
      // Si encontramos otro step o el final del archivo
      if ((line.startsWith("Given('") || line.startsWith('Given(') ||
           line.startsWith("When('") || line.startsWith('When(') ||
           line.startsWith("Then('") || line.startsWith('Then(')) && 
          endLine !== startLine) {
        break;
      }
      
      endLine++;
    }
    
    return endLine;
  }

  /**
   * Parses step blocks (Given, When, Then) and removes unnecessary imports.
   * 
   * @param stepsCode - The step code to parse
   * @returns Object with separated Given, When, and Then blocks
   * 
   * @example
   * ```typescript
   * const code = 'Given("user exists", () => {})\nWhen("user logs in", () => {})';
   * const blocks = stepService.parseStepBlocks(code);
   * console.log('Given block:', blocks.given);
   * ```
   */
  parseStepBlocks(stepsCode: string): { given?: string; when?: string; then?: string } {
    const blocks: { given?: string; when?: string; then?: string } = {};
    const lines = stepsCode.split('\n');
    
    let currentBlock: string | null = null;
    let currentContent: string[] = [];
    
    for (const line of lines) {
      // Skip import lines and file comments
      if (line.trim().startsWith('import ') || 
          line.trim().startsWith('// steps/') || 
          line.trim().startsWith('// features/')) {
        continue;
      }
      
      if (line.trim().startsWith('Given(')) {
        if (currentBlock && currentContent.length > 0) {
          blocks[currentBlock as keyof typeof blocks] = currentContent.join('\n');
        }
        currentBlock = 'given';
        currentContent = [line];
      } else if (line.trim().startsWith('When(')) {
        if (currentBlock && currentContent.length > 0) {
          blocks[currentBlock as keyof typeof blocks] = currentContent.join('\n');
        }
        currentBlock = 'when';
        currentContent = [line];
      } else if (line.trim().startsWith('Then(')) {
        if (currentBlock && currentContent.length > 0) {
          blocks[currentBlock as keyof typeof blocks] = currentContent.join('\n');
        }
        currentBlock = 'then';
        currentContent = [line];
      } else if (currentBlock) {
        currentContent.push(line);
      }
    }
    
    // Add the last block
    if (currentBlock && currentContent.length > 0) {
      blocks[currentBlock as keyof typeof blocks] = currentContent.join('\n');
    }
    
    return blocks;
  }

  /**
   * Checks if a step already exists in the file (improved to ignore parameters).
   * 
   * @param filePath - Path to the step file to check
   * @param stepPattern - The step pattern to search for
   * @returns True if the step exists, false otherwise
   * 
   * @example
   * ```typescript
   * const exists = stepService.stepExists('user.steps.ts', 'user is logged in');
   * if (exists) {
   *   console.log('Step already exists');
   * }
   * ```
   */
  stepExists(filePath: string, stepPattern: string): boolean {
    if (!fs.existsSync(filePath)) {
      return false;
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Clean pattern of specific parameters (e.g.: {int}, 330, etc.)
      const cleanPattern = stepPattern
        .replace(/\{int\}/g, '\\d+')
        .replace(/\{string\}/g, '[^\\s]+')
        .replace(/\{float\}/g, '\\d+\\.\\d+')
        .replace(/\d+/g, '\\d+'); // Replace specific numbers with \d+
      
      const escapedPattern = cleanPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?:Given|When|Then|And|But)\\(['"\`][^'"\`]*${escapedPattern}[^'"\`]*['"\`]`);
      
      const exists = regex.test(content);
      if (exists) {
        this.logger.log(`🔍 Duplicate step detected: ${stepPattern} → ${cleanPattern}`);
      }
      return exists;
    } catch (error) {
      this.logger.warn(`Error checking existing step: ${error.message}`);
      return false;
    }
  }

  /**
   * Gets the content of the step file.
   * 
   * @param filePath - Path to the step file
   * @returns File content as string or null if file doesn't exist
   * 
   * @example
   * ```typescript
   * const content = stepService.getStepsContent('user.steps.ts');
   * if (content) {
   *   console.log('File content:', content);
   * }
   * ```
   */
  getStepsContent(filePath: string): string | null {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * Writes content to the step file.
   * 
   * @param filePath - Path to the step file
   * @param content - Content to write to the file
   * 
   * @example
   * ```typescript
   * stepService.writeStepsContent('user.steps.ts', 'Given("test", () => {})');
   * ```
   */
  writeStepsContent(filePath: string, content: string): void {
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * Finds the last step of a specific type as a fallback method.
   * 
   * @private
   * @param lines - Array of file lines to search
   * @param stepType - Type of step to search for (Given, When, Then)
   * @param generationId - Unique identifier for the generation process
   * @returns Line number of the last step of the specified type (0-indexed) or -1 if not found
   */
  private findLastStepOfType(
    lines: string[], 
    stepType: 'Given' | 'When' | 'Then',
    generationId: string
  ): number {
    this.logger.log(`🔍 [${generationId}] Searching for last ${stepType} as fallback method...`);
    
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith(`${stepType}(`)) {
        this.logger.log(`🎯 [${generationId}] Last ${stepType} found at line ${i + 1}: ${line.substring(0, 50)}...`);
        return i;
      }
    }
    
    this.logger.warn(`⚠️ [${generationId}] No ${stepType} found in file`);
    return -1;
  }
} 