import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Service responsible for cleaning up endpoint artifacts and managing project file structure.
 * 
 * This service handles the removal of generated testing artifacts when endpoints are deleted
 * or updated. It manages file deletion, empty directory cleanup, and section management
 * to maintain a clean project structure.
 * 
 * @class CleanupService
 * @since 1.0.0
 */
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  /**
   * Removes endpoint artifacts and cleans up empty directories.
   * 
   * This method performs comprehensive cleanup of endpoint-related files including
   * artifacts, features, steps, and empty directories. It ensures the project
   * structure remains clean after endpoint deletion or updates.
   * 
   * @param projectPath - The root path of the Playwright project
   * @param artifacts - Object containing artifact file paths to delete
   * @param section - The section/category of the endpoint being cleaned up
   * @param entityName - Optional entity name for additional feature/step cleanup
   * @returns Promise that resolves when cleanup is completed
   * @throws Error when cleanup operations fail
   * 
   * @example
   * ```typescript
   * await cleanup.cleanupEndpointArtifacts('/project', artifacts, 'ecommerce', 'Product');
   * ```
   */
  async cleanupEndpointArtifacts(
    projectPath: string,
    artifacts: any,
    section: string,
    entityName?: string,
  ): Promise<void> {
    try {
      // Delete specific artifact files
      await this.deleteArtifactFiles(projectPath, artifacts);

      // If entityName is provided, also delete feature and step files
      if (entityName) {
        await this.deleteFeatureAndStepsFiles(projectPath, section, entityName);
      }

      // Clean up empty section directories
      await this.cleanupEmptySectionDirectories(projectPath, section);

      this.logger.log(`Cleanup completed for section: ${section}, entity: ${entityName || 'N/A'}`);
    } catch (error) {
      this.logger.error(`Error during cleanup: ${error.message}`);
      throw error;
    }
  }

  /**
   * Deletes specific artifact files from the project.
   * 
   * This private method handles the deletion of individual artifact files
   * including features, steps, fixtures, schemas, types, and client files.
   * It gracefully handles file not found errors and logs deletion results.
   * 
   * @private
   * @param projectPath - The root path of the Playwright project
   * @param artifacts - Object containing artifact file paths to delete
   * @returns Promise that resolves when all files have been processed
   */
  private async deleteArtifactFiles(
    projectPath: string,
    artifacts: any,
  ): Promise<void> {
    const filesToDelete = [
      artifacts.feature,
      artifacts.steps,
      artifacts.fixture,
      artifacts.schema,
      artifacts.types,
      artifacts.client,
    ];

    for (const file of filesToDelete) {
      if (file) {
        const filePath = path.join(projectPath, file);
        try {
          await fs.unlink(filePath);
          this.logger.log(`File deleted: ${file}`);
        } catch (error: any) {
          if (error.code !== 'ENOENT') {
            this.logger.warn(`Could not delete ${filePath}: ${error.message}`);
          }
        }
      }
    }
  }

  /**
   * Deletes feature and step files specific to an entity.
   * 
   * This private method removes Gherkin feature files and step definition files
   * that are specific to a particular entity within a section.
   * 
   * @private
   * @param projectPath - The root path of the Playwright project
   * @param section - The section/category of the entity
   * @param entityName - The name of the entity to clean up
   * @returns Promise that resolves when all files have been processed
   */
  private async deleteFeatureAndStepsFiles(
    projectPath: string,
    section: string,
    entityName: string,
  ): Promise<void> {
    const entityLower = entityName.toLowerCase();
    const filesToDelete = [
      `src/features/${section}/${entityLower}.feature`,
      `src/steps/${section}/${entityLower}.steps.ts`,
    ];

    for (const file of filesToDelete) {
      const filePath = path.join(projectPath, file);
      try {
        await fs.unlink(filePath);
        this.logger.log(`File deleted: ${file}`);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          this.logger.warn(`Could not delete ${filePath}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Cleans up empty directories for a specific section.
   * 
   * This private method removes empty section directories from all artifact
   * directories (features, steps, fixtures, schemas, types, api) when they
   * no longer contain any files.
   * 
   * @private
   * @param projectPath - The root path of the Playwright project
   * @param section - The section/category to clean up
   * @returns Promise that resolves when all directories have been processed
   */
  private async cleanupEmptySectionDirectories(
    projectPath: string,
    section: string,
  ): Promise<void> {
    const sectionDirectories = [
      'src/features',
      'src/steps',
      'src/fixtures',
      'src/schemas',
      'src/types',
      'src/api',
    ];

    for (const baseDir of sectionDirectories) {
      const sectionPath = path.join(projectPath, baseDir, section);
      
      try {
        // Check if the section directory exists
        const sectionStats = await fs.stat(sectionPath);
        
        if (sectionStats.isDirectory()) {
          // Check if the directory is empty
          const files = await fs.readdir(sectionPath);
          
          if (files.length === 0) {
            // Remove empty directory
            await fs.rmdir(sectionPath);
            this.logger.log(`Empty directory removed: ${sectionPath}`);
          } else {
            this.logger.log(`Directory not empty, keeping: ${sectionPath} (${files.length} files)`);
          }
        }
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          this.logger.warn(`Error checking directory ${sectionPath}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Checks if a section is completely empty across all directories.
   * 
   * This method verifies whether a section has any files in any of the
   * artifact directories (features, steps, fixtures, schemas, types, api).
   * 
   * @param projectPath - The root path of the Playwright project
   * @param section - The section/category to check
   * @returns Promise resolving to true if the section is completely empty, false otherwise
   * 
   * @example
   * ```typescript
   * const isEmpty = await cleanup.isSectionEmpty('/project', 'ecommerce');
   * if (isEmpty) {
   *   // Section can be safely removed
   * }
   * ```
   */
  async isSectionEmpty(projectPath: string, section: string): Promise<boolean> {
    const sectionDirectories = [
      'src/features',
      'src/steps',
      'src/fixtures',
      'src/schemas',
      'src/types',
      'src/api',
    ];

    for (const baseDir of sectionDirectories) {
      const sectionPath = path.join(projectPath, baseDir, section);
      
      try {
        const files = await fs.readdir(sectionPath);
        if (files.length > 0) {
          return false; // Section is not empty
        }
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          this.logger.warn(`Error checking directory ${sectionPath}: ${error.message}`);
        }
      }
    }

    return true; // Section is completely empty
  }

  /**
   * Completely removes a section if it is empty.
   * 
   * This method checks if a section is empty across all artifact directories
   * and removes all section directories if no files are found. It provides
   * logging for the removal process and handles errors gracefully.
   * 
   * @param projectPath - The root path of the Playwright project
   * @param section - The section/category to remove
   * @returns Promise that resolves when the section has been processed
   * 
   * @example
   * ```typescript
   * await cleanup.removeEmptySection('/project', 'ecommerce');
   * // Removes all empty ecommerce directories if section is completely empty
   * ```
   */
  async removeEmptySection(projectPath: string, section: string): Promise<void> {
    const isEmpty = await this.isSectionEmpty(projectPath, section);
    
    if (isEmpty) {
      const sectionDirectories = [
        'src/features',
        'src/steps',
        'src/fixtures',
        'src/schemas',
        'src/types',
        'src/api',
      ];

      for (const baseDir of sectionDirectories) {
        const sectionPath = path.join(projectPath, baseDir, section);
        
        try {
          await fs.rmdir(sectionPath);
          this.logger.log(`Section removed: ${sectionPath}`);
        } catch (error: any) {
          if (error.code !== 'ENOENT') {
            this.logger.warn(`Error removing directory ${sectionPath}: ${error.message}`);
          }
        }
      }
      
      this.logger.log(`Section '${section}' completely removed`);
    } else {
      this.logger.log(`Section '${section}' is not empty, keeping`);
    }
  }
} 