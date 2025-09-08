import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { CodeInsertion } from '../../../modules/ai/interfaces/ai-agent.interface';

/**
 * Code Insertion Service
 * 
 * Handles insertion of generated code into existing files. Provides functionality
 * to insert code at specific line numbers, validate insertions, create backups,
 * and manage file modifications with comprehensive error handling and logging.
 * 
 * @class CodeInsertionService
 */
@Injectable()
export class CodeInsertionService {
  private readonly logger = new Logger(CodeInsertionService.name);

  /**
   * Inserts code into files according to the specified insertions.
   * 
   * @param insertions - Array of code insertions to perform
   * @param generationId - Unique identifier for the generation process
   * @returns Promise with insertion results including success status, modified files, and errors
   * 
   * @example
   * ```typescript
   * const insertions = [
   *   { file: 'test.feature', line: 10, content: 'Scenario: New test', type: 'scenario', description: 'Add new scenario' }
   * ];
   * const result = await codeInsertionService.insertCode(insertions, 'gen-123');
   * ```
   */
  async insertCode(
    insertions: CodeInsertion[],
    generationId: string
  ): Promise<{ success: boolean; modifiedFiles: string[]; errors: string[] }> {
    this.logger.log(`📝 [${generationId}] Starting real code insertion...`);
    this.logger.log(`📊 [${generationId}] Total insertions to process: ${insertions.length}`);
    
    const modifiedFiles: string[] = [];
    const errors: string[] = [];
    
    for (let i = 0; i < insertions.length; i++) {
      const insertion = insertions[i];
      this.logger.log(`📝 [${generationId}] Processing insertion ${i + 1}/${insertions.length}: ${insertion.file} line ${insertion.line}`);
      this.logger.log(`📝 [${generationId}] Type: ${insertion.type}, Description: ${insertion.description}`);
      
      try {
        const result = await this.insertSingleCode(insertion, generationId);
        if (result.success) {
          modifiedFiles.push(insertion.file);
        } else {
          errors.push(result.error || 'Unknown error');
        }
      } catch (error: any) {
        const errorMsg = `Error processing insertion ${i + 1}: ${error.message}`;
        errors.push(errorMsg);
        this.logger.error(`❌ [${generationId}] ${errorMsg}`);
        this.logger.error(`❌ [${generationId}] Stack trace: ${error.stack}`);
      }
    }
    
    const result = {
      success: errors.length === 0,
      modifiedFiles,
      errors,
    };
    
    this.logger.log(`📊 [${generationId}] Insertion summary:`);
    this.logger.log(`📊 [${generationId}] - Modified files: ${modifiedFiles.length}`);
    this.logger.log(`📊 [${generationId}] - Errors: ${errors.length}`);
    this.logger.log(`✅ [${generationId}] Insertion completed: ${JSON.stringify(result, null, 2)}`);
    
    return result;
  }

  /**
   * Inserts code into a single file.
   * 
   * @private
   * @param insertion - The code insertion to perform
   * @param generationId - Unique identifier for the generation process
   * @returns Promise with success status and optional error message
   */
  private async insertSingleCode(
    insertion: CodeInsertion,
    generationId: string
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.log(`🔍 [${generationId}] Verifying file existence: ${insertion.file}`);
    
    if (!fs.existsSync(insertion.file)) {
      const errorMsg = `File not found: ${insertion.file}`;
      this.logger.error(`❌ [${generationId}] ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
    
    this.logger.log(`✅ [${generationId}] File found, reading content...`);
    
    // Read current file
    const content = fs.readFileSync(insertion.file, 'utf-8');
    const lines = content.split('\n');
    this.logger.log(`📊 [${generationId}] File has ${lines.length} lines`);
    
    // Insert code at specified line
    if (insertion.line > lines.length) {
      this.logger.log(`📝 [${generationId}] Line ${insertion.line} > ${lines.length}, adding to end of file`);
      lines.push(insertion.content);
    } else {
      this.logger.log(`📝 [${generationId}] Inserting at line ${insertion.line} (index ${insertion.line - 1})`);
      this.logger.log(`📝 [${generationId}] Content to insert: ${insertion.content.substring(0, 100)}...`);
      lines.splice(insertion.line - 1, 0, insertion.content);
    }
    
    this.logger.log(`📊 [${generationId}] File modified, now has ${lines.length} lines`);
    
    // Write modified file
    const newContent = lines.join('\n');
    this.logger.log(`💾 [${generationId}] Writing modified file...`);
    fs.writeFileSync(insertion.file, newContent, 'utf-8');
    
    this.logger.log(`✅ [${generationId}] Successfully inserted in: ${insertion.file}`);
    return { success: true };
  }

  /**
   * Validates that an insertion is valid before executing it.
   * 
   * @param insertion - The code insertion to validate
   * @returns Validation result with success status and error messages
   * 
   * @example
   * ```typescript
   * const insertion = { file: 'test.feature', line: 10, content: 'Scenario: Test', type: 'scenario', description: 'Add test' };
   * const validation = codeInsertionService.validateInsertion(insertion);
   * if (!validation.isValid) {
   *   console.log('Validation errors:', validation.errors);
   * }
   * ```
   */
  validateInsertion(insertion: CodeInsertion): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!insertion.file) {
      errors.push('File not specified');
    }
    
    if (!insertion.content) {
      errors.push('Content not specified');
    }
    
    if (insertion.line < 1) {
      errors.push('Line must be greater than 0');
    }
    
    if (!insertion.type) {
      errors.push('Insertion type not specified');
    }
    
    return { isValid: errors.length === 0, errors };
  }

  /**
   * Creates a backup of the file before modifying it.
   * 
   * @param filePath - Path to the file to backup
   * @param generationId - Unique identifier for the generation process
   * @returns Path to the backup file or null if backup failed
   * 
   * @example
   * ```typescript
   * const backupPath = codeInsertionService.createBackup('test.feature', 'gen-123');
   * if (backupPath) {
   *   console.log(`Backup created at: ${backupPath}`);
   * }
   * ```
   */
  createBackup(filePath: string, generationId: string): string | null {
    try {
      const backupPath = `${filePath}.backup.${Date.now()}`;
      fs.copyFileSync(filePath, backupPath);
      this.logger.log(`📄 [${generationId}] Backup created: ${backupPath}`);
      return backupPath;
    } catch (error: any) {
      this.logger.error(`❌ [${generationId}] Error creating backup: ${error.message}`);
      return null;
    }
  }

  /**
   * Restores a file from its backup.
   * 
   * @param backupPath - Path to the backup file
   * @param originalPath - Path to restore the file to
   * @param generationId - Unique identifier for the generation process
   * @returns True if restoration was successful, false otherwise
   * 
   * @example
   * ```typescript
   * const success = codeInsertionService.restoreFromBackup('test.feature.backup.123', 'test.feature', 'gen-123');
   * if (success) {
   *   console.log('File restored successfully');
   * }
   * ```
   */
  restoreFromBackup(backupPath: string, originalPath: string, generationId: string): boolean {
    try {
      fs.copyFileSync(backupPath, originalPath);
      this.logger.log(`📄 [${generationId}] File restored from backup: ${backupPath}`);
      return true;
    } catch (error: any) {
      this.logger.error(`❌ [${generationId}] Error restoring from backup: ${error.message}`);
      return false;
    }
  }

  /**
   * Removes a backup file.
   * 
   * @param backupPath - Path to the backup file to remove
   * @param generationId - Unique identifier for the generation process
   * @returns True if removal was successful, false otherwise
   * 
   * @example
   * ```typescript
   * const success = codeInsertionService.removeBackup('test.feature.backup.123', 'gen-123');
   * if (success) {
   *   console.log('Backup removed successfully');
   * }
   * ```
   */
  removeBackup(backupPath: string, generationId: string): boolean {
    try {
      fs.unlinkSync(backupPath);
      this.logger.log(`📄 [${generationId}] Backup removed: ${backupPath}`);
      return true;
    } catch (error: any) {
      this.logger.error(`❌ [${generationId}] Error removing backup: ${error.message}`);
      return false;
    }
  }

  /**
   * Gets statistics about the insertions.
   * 
   * @param insertions - Array of code insertions to analyze
   * @returns Statistics including total count, count by type, and unique files
   * 
   * @example
   * ```typescript
   * const insertions = [
   *   { file: 'test.feature', line: 10, content: 'Scenario: Test', type: 'scenario', description: 'Add test' },
   *   { file: 'test.steps.ts', line: 5, content: 'Given("test", () => {})', type: 'step', description: 'Add step' }
   * ];
   * const stats = codeInsertionService.getInsertionStats(insertions);
   * console.log(`Total insertions: ${stats.total}, Files: ${stats.files.length}`);
   * ```
   */
  getInsertionStats(insertions: CodeInsertion[]): {
    total: number;
    byType: Record<string, number>;
    files: string[];
  } {
    const stats = {
      total: insertions.length,
      byType: {} as Record<string, number>,
      files: [] as string[],
    };
    
    const uniqueFiles = new Set<string>();
    
    for (const insertion of insertions) {
      // Count by type
      stats.byType[insertion.type] = (stats.byType[insertion.type] || 0) + 1;
      
      // Add unique file
      uniqueFiles.add(insertion.file);
    }
    
    stats.files = Array.from(uniqueFiles);
    
    return stats;
  }
} 