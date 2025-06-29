import { Injectable, Logger } from '@nestjs/common';
import { Project, ProjectStatus } from '../project.entity';
import { WorkspaceService } from '../../workspace/workspace.service';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second

  constructor(private readonly workspaceService: WorkspaceService) {}

  /**
   * Clean up a failed project
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
   * Clean partially generated files
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
   * Clean installed dependencies
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
   * Clean temporary files
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
   * Restore project state
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
   * Emergency cleanup - delete entire workspace
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
   * Clean orphaned projects (projects that remained in PENDING status for too long)
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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
