import { Injectable, Logger } from '@nestjs/common';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { Project } from '../project.entity';
import * as fs from 'fs/promises';
import * as path from 'path';

const exec = promisify(execCallback);
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

@Injectable()
export class PlaywrightService {
  private readonly logger = new Logger(PlaywrightService.name);

  async initializeProject(project: Project): Promise<void> {
    // Initialize Playwright project with all basic configurations
    await this.execCommand(
      'npm init playwright@latest --quiet --yes -- --quiet',
      project.path,
    );

    // Install additional dependencies for BDD
    await this.execCommand(
      'npm install --save-dev @cucumber/cucumber @cucumber/pretty-formatter @faker-js/faker ajv ajv-formats',
      project.path,
    );

    // Clean example files
    await this.cleanExampleFiles(project.path);
  }

  private async cleanExampleFiles(projectPath: string): Promise<void> {
    const filesToDelete = [
      'tests/example.spec.ts',
      'tests-examples/demo-todo-app.spec.ts',
      'tests-examples'
    ];

    for (const file of filesToDelete) {
      const fullPath = path.join(projectPath, file);
      
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          // Check if file is blocked
          try {
            const fileHandle = await fs.open(fullPath, 'r+');
            await fileHandle.close();
          } catch (error) {
            if (error.code === 'EBUSY' || error.code === 'EPERM') {
              this.logger.warn(`Blocked file on attempt ${attempt}: ${file}`);
              if (attempt === MAX_RETRIES) {
                this.logger.error(`Could not delete blocked file: ${file}`);
                continue; // Skip to next file
              }
              await this.sleep(RETRY_DELAY);
              continue;
            }
          }

          await fs.rm(fullPath, { recursive: true, force: true });
          this.logger.debug(`Example file deleted: ${file}`);
          break; // Exit retry loop if deleted successfully
        } catch (error) {
          if (error.code === 'ENOENT') {
            break; // File no longer exists, continue with next
          }
          
          if (attempt === MAX_RETRIES) {
            this.logger.warn(`Could not delete ${file}: ${error.message}`);
            break;
          }
          
          await this.sleep(RETRY_DELAY);
        }
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runHealthCheck(project: Project): Promise<boolean> {
    try {
      // Create a basic health check test
      const healthTestContent = `
import { test, expect } from '@playwright/test';

test('health check - project setup', async () => {
  // Verify that base configuration is correct
  expect(process.env.npm_package_name).toBe('${project.name}');
  
  // Verify that we can import main dependencies
  const { Given, When, Then } = require('@cucumber/cucumber');
  const { faker } = require('@faker-js/faker');
  const Ajv = require('ajv');
  
  expect(Given).toBeDefined();
  expect(faker).toBeDefined();
  expect(Ajv).toBeDefined();
});`;

      await fs.writeFile(
        path.join(project.path, 'tests/health.spec.ts'),
        healthTestContent
      );

      // Run health check test
      await this.execCommand('npx playwright test tests/health.spec.ts', project.path);
      
      return true;
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return false;
    }
  }

  private async execCommand(command: string, cwd: string): Promise<void> {
    try {
      const { stdout, stderr } = await exec(command, { cwd });
      if (stdout) this.logger.debug(stdout);
      if (stderr) this.logger.warn(stderr);
    } catch (error) {
      this.logger.error(`Error executing command: ${command}`);
      this.logger.error(error);
      throw error;
    }
  }
} 