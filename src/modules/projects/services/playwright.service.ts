import { Injectable, Logger } from '@nestjs/common';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { Project } from '../project.entity';
import * as fs from 'fs/promises';
import * as path from 'path';

const exec = promisify(execCallback);
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const COMMAND_TIMEOUT = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class PlaywrightService {
  private readonly logger = new Logger(PlaywrightService.name);

  async initializeProject(project: Project): Promise<void> {
    this.logger.log(`Starting Playwright initialization for project: ${project.name}`);
    
    try {
      // Step 1: Initialize Playwright project with timeout
      this.logger.log('Step 1: Initializing Playwright project...');
      await this.execCommandWithTimeout(
        'npm init playwright@latest --quiet --yes -- --quiet',
        project.path,
        'Playwright initialization'
      );

      // Step 2: Install additional dependencies for BDD
      this.logger.log('Step 2: Installing BDD dependencies...');
      await this.execCommandWithTimeout(
        'npm install --save-dev @cucumber/cucumber @cucumber/pretty-formatter @faker-js/faker ajv ajv-formats',
        project.path,
        'BDD dependencies installation'
      );

      // Step 3: Clean example files
      this.logger.log('Step 3: Cleaning example files...');
      await this.cleanExampleFiles(project.path);
      
      this.logger.log(`Playwright initialization completed successfully for: ${project.name}`);
    } catch (error) {
      this.logger.error(`Playwright initialization failed for ${project.name}:`, error);
      throw error;
    }
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
    this.logger.log(`Running health check for project: ${project.name}`);
    
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

      // Run health check test with timeout
      await this.execCommandWithTimeout(
        'npx playwright test tests/health.spec.ts',
        project.path,
        'Health check test'
      );
      
      this.logger.log(`Health check passed for project: ${project.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Health check failed for ${project.name}:`, error);
      return false;
    }
  }

  private async execCommandWithTimeout(
    command: string, 
    cwd: string, 
    operationName: string
  ): Promise<void> {
    this.logger.log(`Executing: ${operationName} in ${cwd}`);
    this.logger.debug(`Command: ${command}`);
    
    try {
      const { stdout, stderr } = await exec(command, { 
        cwd,
        timeout: COMMAND_TIMEOUT,
        env: {
          ...process.env,
          // Ensure npm doesn't hang on interactive prompts
          CI: 'true',
          NODE_ENV: 'production',
          // Force npm to use non-interactive mode
          npm_config_yes: 'true',
          npm_config_quiet: 'true'
        }
      });
      
      if (stdout) {
        this.logger.debug(`${operationName} stdout: ${stdout.substring(0, 500)}...`);
      }
      if (stderr) {
        this.logger.warn(`${operationName} stderr: ${stderr.substring(0, 500)}...`);
      }
      
      this.logger.log(`${operationName} completed successfully`);
    } catch (error) {
      this.logger.error(`${operationName} failed:`, error);
      this.logger.error(`Command: ${command}`);
      this.logger.error(`Working directory: ${cwd}`);
      
      // Provide more specific error information
      if (error.code === 'ETIMEDOUT') {
        throw new Error(`${operationName} timed out after ${COMMAND_TIMEOUT}ms`);
      }
      if (error.code === 'ENOENT') {
        throw new Error(`${operationName} failed: Command not found. Make sure npm/node is available`);
      }
      
      throw error;
    }
  }

  private async execCommand(command: string, cwd: string): Promise<void> {
    return this.execCommandWithTimeout(command, cwd, 'Command execution');
  }
} 