import { Injectable, Logger } from '@nestjs/common';
import { Project, ProjectStatus } from '../project.entity';
import { WorkspaceService } from '../../workspace/workspace.service';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Service for cleaning up failed projects and orphaned resources.
 * 
 * This service provides comprehensive cleanup functionality for projects that
 * fail during generation or become orphaned. It handles file cleanup,
 * dependency removal, and workspace restoration.
 * 
 * @class CleanupService
 * @since 1.0.0
 */
@Injectable()
export class CleanupService {
  /** Logger instance for this service */
  private readonly logger = new Logger(CleanupService.name);
  
  /** Maximum number of retry attempts for file operations */
  private readonly maxRetries = 3;
  
  /** Delay between retry attempts in milliseconds */
  private readonly retryDelay = 1000;

  /**
   * Creates an instance of CleanupService.
   * 
   * @param workspaceService - Service for workspace management
   */
  constructor(private readonly workspaceService: WorkspaceService) {}

  /**
   * Cleans up a failed project.
   * 
   * This method performs comprehensive cleanup of a project that failed during
   * generation, including file cleanup, dependency removal, and state restoration.
   * 
   * @param project - The project to clean up
   * @param error - The error that caused the failure
   * @returns Promise that resolves when cleanup is complete
   * 
   * @example
   * ```typescript
   * try {
   *   await generationService.generateProject(project);
   * } catch (error) {
   *   await cleanupService.cleanupFailedProject(project, error);
   * }
   * ```
   */
  async cleanupFailedProject(project: Project, error: Error): Promise<void> {
    this.logger.warn(`Starting cleanup for failed project: ${project.name}`);
    this.logger.warn(`Error that triggered cleanup: ${error.message}`);

    try {
      // 1. Clean partially generated files
      await this.cleanupGeneratedFiles(project);

      // 2. Clean installed dependencies
      await this.cleanupDependencies(project);

      // 3. Clean temporary files
      await this.cleanupTempFiles(project);

      // 4. Restore project state
      await this.restoreProjectState(project);

      this.logger.log(`Cleanup completed for project: ${project.name}`);
    } catch (cleanupError) {
      this.logger.error(
        `Error during cleanup of project ${project.name}: ${cleanupError.message}`,
      );

      // If cleanup fails, try to delete the entire workspace
      await this.emergencyCleanup(project);
    }
  }

  /**
   * Cleans up partially generated files.
   * 
   * This method removes files that were created during project generation
   * but are no longer needed after a failure.
   * 
   * @param project - The project to clean up
   * @returns Promise that resolves when file cleanup is complete
   * @private
   */
  private async cleanupGeneratedFiles(project: Project): Promise<void> {
    const filesToClean = [
      'src/api/api.config.ts',
      'src/steps/hooks.ts',
      'src/steps/world.ts',
      'cucumber.cjs',
      'tests/health.spec.ts',
    ];

    for (const file of filesToClean) {
      const filePath = path.join(project.path, file);

      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          await fs.unlink(filePath);
          this.logger.debug(`File deleted: ${file}`);
          break;
        } catch (error: any) {
          if (error.code === 'ENOENT') {
            // File doesn't exist, continue
            break;
          }

          if (attempt === this.maxRetries) {
            this.logger.warn(`Could not delete ${file}: ${error.message}`);
            break;
          }

          await this.sleep(this.retryDelay);
        }
      }
    }
  }

  /**
   * Cleans up installed dependencies.
   * 
   * This method removes node_modules and package-lock.json files
   * to clean up dependency installations.
   * 
   * @param project - The project to clean up
   * @returns Promise that resolves when dependency cleanup is complete
   * @private
   */
  private async cleanupDependencies(project: Project): Promise<void> {
    const nodeModulesPath = path.join(project.path, 'node_modules');
    const packageLockPath = path.join(project.path, 'package-lock.json');

    try {
      // Delete node_modules
      await fs.rm(nodeModulesPath, { recursive: true, force: true });
      this.logger.debug('node_modules deleted');

      // Delete package-lock.json
      await fs.unlink(packageLockPath);
      this.logger.debug('package-lock.json deleted');
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        this.logger.warn(`Error cleaning dependencies: ${error.message}`);
      }
    }
  }

  /**
   * Cleans up temporary files and directories.
   * 
   * This method removes temporary directories created during testing
   * and project generation.
   * 
   * @param project - The project to clean up
   * @returns Promise that resolves when temporary file cleanup is complete
   * @private
   */
  private async cleanupTempFiles(project: Project): Promise<void> {
    const tempDirs = [
      'test-results',
      'playwright-report',
      'blob-report',
      '.playwright',
    ];

    for (const dir of tempDirs) {
      const dirPath = path.join(project.path, dir);

      try {
        await fs.rm(dirPath, { recursive: true, force: true });
        this.logger.debug(`Temporary directory deleted: ${dir}`);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          this.logger.warn(
            `Error deleting temporary directory ${dir}: ${error.message}`,
          );
        }
      }
    }
  }

  /**
   * Restores the project to a basic working state.
   * 
   * This method restores essential configuration files to their basic
   * state so the project can be used or regenerated later.
   * 
   * @param project - The project to restore
   * @returns Promise that resolves when project state is restored
   * @private
   */
  private async restoreProjectState(project: Project): Promise<void> {
    // Restore original package.json
    const packageJsonPath = path.join(project.path, 'package.json');
    const originalPackageJson = {
      name: project.name,
      version: '1.0.0',
      description: 'Automatically generated test project',
      type: 'commonjs',
      scripts: {
        test: 'echo "Error: no test specified" && exit 1',
      },
      keywords: [],
      author: '',
      license: 'ISC',
    };

    try {
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(originalPackageJson, null, 2),
      );
      this.logger.debug('package.json restored');
    } catch (error: any) {
      this.logger.warn(`Error restoring package.json: ${error.message}`);
    }

    // Restore basic playwright.config.ts
    const playwrightConfigPath = path.join(
      project.path,
      'playwright.config.ts',
    );
    const basicPlaywrightConfig = `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: '${project.baseUrl}',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});`;

    try {
      await fs.writeFile(playwrightConfigPath, basicPlaywrightConfig);
      this.logger.debug('playwright.config.ts restored');
    } catch (error: any) {
      this.logger.warn(
        `Error restoring playwright.config.ts: ${error.message}`,
      );
    }
  }

  /**
   * Performs emergency cleanup by deleting the entire workspace.
   * 
   * This method is used as a last resort when normal cleanup fails.
   * It completely removes the workspace directory.
   * 
   * @param project - The project to perform emergency cleanup on
   * @returns Promise that resolves when emergency cleanup is complete
   * @private
   */
  private async emergencyCleanup(project: Project): Promise<void> {
    this.logger.error(`Executing emergency cleanup for: ${project.name}`);

    try {
      await this.workspaceService.deleteWorkspace(project.name);
      this.logger.log(
        `Workspace deleted in emergency cleanup: ${project.name}`,
      );
    } catch (error: any) {
      this.logger.error(`Error in emergency cleanup: ${error.message}`);
    }
  }

  /**
   * Cleans up orphaned projects.
   * 
   * This method identifies and cleans up projects that have been in PENDING
   * status for too long, indicating they may have been abandoned.
   * 
   * @param projects - Array of projects to check for orphaned status
   * @returns Promise that resolves when orphaned project cleanup is complete
   * 
   * @example
   * ```typescript
   * const projects = await projectRepo.find();
   * await cleanupService.cleanupOrphanedProjects(projects);
   * ```
   */
  async cleanupOrphanedProjects(projects: Project[]): Promise<void> {
    const orphanedProjects = projects.filter((project) => {
      const timeDiff = Date.now() - project.createdAt.getTime();
      const maxPendingTime = 30 * 60 * 1000; // 30 minutes
      return (
        project.status === ProjectStatus.PENDING && timeDiff > maxPendingTime
      );
    });

    for (const project of orphanedProjects) {
      this.logger.warn(`Cleaning orphaned project: ${project.name}`);
      await this.cleanupFailedProject(
        project,
        new Error('Orphaned project detected'),
      );
    }
  }

  /**
   * Creates a delay for the specified number of milliseconds.
   * 
   * @param ms - The number of milliseconds to delay
   * @returns Promise that resolves after the specified delay
   * @private
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
