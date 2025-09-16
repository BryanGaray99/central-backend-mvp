import { Injectable, Logger } from '@nestjs/common';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { Project } from '../project.entity';
import * as fs from 'fs/promises';
import * as path from 'path';

const exec = promisify(execCallback);

/** Maximum number of retry attempts for file operations */
const MAX_RETRIES = 1;

/** Delay between retry attempts in milliseconds */
const RETRY_DELAY = 1000;

/** Command execution timeout in milliseconds */
const COMMAND_TIMEOUT = 10 * 60 * 1000;

/**
 * Service for Playwright project initialization and management.
 * 
 * This service handles the initialization of Playwright projects, including
 * dependency installation, example file cleanup, and health checks.
 * It provides a robust interface for managing Playwright testing environments.
 * 
 * @class PlaywrightService
 * @since 1.0.0
 */
@Injectable()
export class PlaywrightService {
  /** Logger instance for this service */
  private readonly logger = new Logger(PlaywrightService.name);

  /**
   * Initializes a Playwright project with BDD support.
   * 
   * This method performs a complete Playwright project initialization including:
   * 1. Playwright project creation with browser download skip
   * 2. BDD dependencies installation
   * 3. Example files cleanup
   * 
   * @param project - The project to initialize
   * @returns Promise that resolves when initialization is complete
   * @throws {Error} When initialization fails
   * 
   * @example
   * ```typescript
   * const project = await projectRepo.findOne({ where: { id: 'project-id' } });
   * await playwrightService.initializeProject(project);
   * console.log('Playwright project initialized');
   * ```
   */
  async initializeProject(project: Project): Promise<void> {
    this.logger.log(
      `Starting Playwright initialization for project: ${project.name}`,
    );

    try {
      // Step 1: Initialize Playwright project with skip browser download
      this.logger.log('Step 1: Initializing Playwright project...');
      await this.execCommandWithTimeout(
        'npm init playwright@latest -- --yes --quiet',
        project.path,
        'Playwright initialization',
        {
          NODE_ENV: 'development',
          PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
        },
      );

      // Step 2: Install additional dependencies for BDD
      this.logger.log('Step 2: Installing BDD dependencies...');
      await this.execCommandWithTimeout(
        'npm install --save-dev @playwright/test @cucumber/cucumber @cucumber/pretty-formatter @faker-js/faker@^9.0.0 ajv ajv-formats typescript ts-node @types/node dotenv',
        project.path,
        'BDD dependencies installation',
        { NODE_ENV: 'development' },
      );

      // Step 3: Clean example files
      this.logger.log('Step 3: Cleaning example files...');
      await this.cleanExampleFiles(project.path);

      this.logger.log(
        `Playwright initialization completed successfully for: ${project.name}`,
      );
    } catch (error) {
      this.logger.error(
        `Playwright initialization failed for ${project.name}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Cleans up example files from the Playwright project.
   * 
   * This method removes default example files and directories that are not
   * needed for the BDD testing setup.
   * 
   * @param projectPath - The path to the project directory
   * @returns Promise that resolves when cleanup is complete
   * @private
   */
  private async cleanExampleFiles(projectPath: string): Promise<void> {
    const filesToDelete = [
      'tests/example.spec.ts',
      'tests-examples/demo-todo-app.spec.ts',
      'tests-examples',
    ];

    for (const file of filesToDelete) {
      const fullPath = path.join(projectPath, file);

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          // Check if file is blocked
          try {
            const fileHandle = await fs.open(fullPath, 'r+');
            await fileHandle.close();
          } catch (err) {
            if (err.code === 'EBUSY' || err.code === 'EPERM') {
              this.logger.warn(`Blocked file on attempt ${attempt}: ${file}`);
              if (attempt === MAX_RETRIES) {
                this.logger.error(`Could not delete blocked file: ${file}`);
                continue;
              }
              await this.sleep(RETRY_DELAY);
              continue;
            }
          }

          await fs.rm(fullPath, { recursive: true, force: true });
          this.logger.debug(`Example file deleted: ${file}`);
          break;
        } catch (err) {
          if (err.code === 'ENOENT') break;
          if (attempt === MAX_RETRIES) {
            this.logger.warn(`Could not delete ${file}: ${err.message}`);
            break;
          }
          await this.sleep(RETRY_DELAY);
        }
      }
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

  /**
   * Runs a health check to verify the project setup.
   * 
   * This method creates and runs a test to verify that all dependencies
   * are properly installed and the project structure is correct.
   * 
   * @param project - The project to check
   * @returns Promise that resolves to true if health check passes, false otherwise
   * 
   * @example
   * ```typescript
   * const isHealthy = await playwrightService.runHealthCheck(project);
   * if (isHealthy) {
   *   console.log('Project is ready');
   * } else {
   *   console.log('Project has issues');
   * }
   * ```
   */
  async runHealthCheck(project: Project): Promise<boolean> {
    this.logger.log(`Running health check for project: ${project.name}`);

    try {
      // Ensure src/tests directory exists
      const testsDir = path.join(project.path, 'src', 'tests');
      await fs.mkdir(testsDir, { recursive: true });

      const healthTestContent = `
import { test, expect } from '@playwright/test';

test('health check - project setup', async () => {
  // Verify that required dependencies are available
  const { Given, When, Then } = require('@cucumber/cucumber');
  const { faker } = require('@faker-js/faker');
  const Ajv = require('ajv');
  
  // Check that dependencies are properly installed
  expect(Given).toBeDefined();
  expect(faker).toBeDefined();
  expect(Ajv).toBeDefined();
  
  // Verify that we can access the project structure
  expect(process.cwd()).toContain('${project.name}');
});`;

      const healthTestPath = path.join(project.path, 'src/tests/health.spec.ts');
      await fs.writeFile(healthTestPath, healthTestContent);

      // Run health check with NODE_ENV=development to ensure devDependencies are present
      await this.execCommandWithTimeout(
        'npx playwright test health.spec.ts',
        project.path,
        'Health check test',
        { NODE_ENV: 'development' },
      );

      this.logger.log(`Health check passed for project: ${project.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Health check failed for ${project.name}:`, error);
      return false;
    }
  }

  /**
   * Executes a command with timeout and environment configuration.
   * 
   * @param command - The command to execute
   * @param cwd - The working directory for the command
   * @param operationName - Name of the operation for logging
   * @param extraEnv - Additional environment variables
   * @returns Promise that resolves when the command completes
   * @throws {Error} When command execution fails or times out
   * @private
   */
  private async execCommandWithTimeout(
    command: string,
    cwd: string,
    operationName: string,
    extraEnv: Record<string, string> = {},
  ): Promise<void> {
    this.logger.log(`Executing: ${operationName} in ${cwd}`);
    this.logger.debug(`Command: ${command}`);
    this.logger.debug(`Env extras: ${JSON.stringify(extraEnv)}`);

    try {
      const env = {
        ...process.env,
        CI: 'true',
        npm_config_yes: 'true',
        npm_config_quiet: 'true',
        ...extraEnv,
      };

      const { stdout, stderr } = await exec(command, {
        cwd,
        timeout: COMMAND_TIMEOUT,
        env,
      });
      if (stdout)
        this.logger.debug(
          `${operationName} stdout: ${stdout.substring(0, 500)}...`,
        );
      if (stderr)
        this.logger.warn(
          `${operationName} stderr: ${stderr.substring(0, 500)}...`,
        );
      this.logger.log(`${operationName} completed successfully`);
    } catch (error) {
      this.logger.error(`${operationName} failed:`, error);
      this.logger.error(`Command: ${command}`);
      this.logger.error(`Working directory: ${cwd}`);
      if (error.code === 'ETIMEDOUT')
        throw new Error(
          `${operationName} timed out after ${COMMAND_TIMEOUT}ms`,
        );
      if (error.code === 'ENOENT')
        throw new Error(`${operationName} failed: Command not found.`);
      throw error;
    }
  }

  /**
   * Executes a command with default settings.
   * 
   * @param command - The command to execute
   * @param cwd - The working directory for the command
   * @returns Promise that resolves when the command completes
   * @private
   */
  private async execCommand(command: string, cwd: string): Promise<void> {
    return this.execCommandWithTimeout(command, cwd, 'Command execution');
  }
}
