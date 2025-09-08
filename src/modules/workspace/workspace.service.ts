import { Injectable, Logger, ConflictException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

/** Maximum number of retry attempts for file operations */
const MAX_RETRIES = 3;

/** Delay between retry attempts in milliseconds */
const RETRY_DELAY = 1000;

/**
 * Service for managing Playwright testing workspaces.
 * 
 * This service handles the creation, deletion, and management of workspace directories
 * for Playwright testing projects. It provides functionality to create isolated
 * testing environments with proper configuration files.
 * 
 * @class WorkspaceService
 * @since 1.0.0
 */
@Injectable()
export class WorkspaceService {
  /** Logger instance for this service */
  private readonly logger = new Logger(WorkspaceService.name);
  
  /** Path to the workspaces directory */
  private readonly workspacesDir: string;

  /**
   * Creates an instance of WorkspaceService.
   * 
   * Initializes the workspaces directory path and creates necessary configuration files.
   * The workspaces directory cannot be located within the central backend directory.
   * 
   * @throws {Error} When the workspaces path is within the central backend directory
   */
  constructor() {
    const envPath = process.env.PLAYWRIGHT_WORKSPACES_PATH || '../playwright-workspaces';
    let dir = envPath;
    if (!path.isAbsolute(dir)) {
      dir = path.resolve(process.cwd(), dir);
    }
    // Check if the path is within the central backend
    const backendRoot = path.resolve(__dirname, '../../..');
    if (dir.startsWith(backendRoot)) {
      throw new Error(
        'PLAYWRIGHT_WORKSPACES_PATH cannot be within the central backend directory.',
      );
    }
    this.workspacesDir = dir;
    
    // Initialize synchronously to ensure .env is created on startup
    this.initSync();
  }

  /**
   * Synchronously initializes the workspace service.
   * 
   * Creates the workspaces directory if it doesn't exist and ensures
   * the root .env file is created.
   * 
   * @private
   */
  private initSync() {
    try {
      // Create directory synchronously if it doesn't exist
      if (!require('fs').existsSync(this.workspacesDir)) {
        require('fs').mkdirSync(this.workspacesDir, { recursive: true });
        this.logger.log(`Created workspaces directory: ${this.workspacesDir}`);
      } else {
        this.logger.log(`Using workspaces directory: ${this.workspacesDir}`);
      }
      
      // Create .env file synchronously
      this.createRootEnvFileSync();
    } catch (error) {
      this.logger.error(`Error during sync initialization: ${error.message}`);
    }
  }

  /**
   * Asynchronously initializes the workspace service.
   * 
   * Creates the workspaces directory if it doesn't exist and ensures
   * the root .env file is created.
   * 
   * @private
   */
  private async init() {
    try {
      await fs.access(this.workspacesDir);
      this.logger.log(`Using workspaces directory: ${this.workspacesDir}`);
    } catch {
      this.logger.warn(
        `Workspaces directory not found, creating: ${this.workspacesDir}`,
      );
      await fs.mkdir(this.workspacesDir, { recursive: true });
    }
    
    // Always ensure the .env file exists when the service initializes
    await this.createRootEnvFile();
  }

  /**
   * Creates a new workspace with the specified name.
   * 
   * @param name - The name of the workspace to create
   * @returns Promise that resolves to the full path of the created workspace
   * @throws {ConflictException} When a workspace with the same name already exists
   * 
   * @example
   * ```typescript
   * const workspacePath = await workspaceService.createWorkspace('my-project');
   * console.log(`Workspace created at: ${workspacePath}`);
   * ```
   */
  async createWorkspace(name: string): Promise<string> {
    const workspacePath = path.join(this.workspacesDir, name);

    try {
      await fs.access(workspacePath);
      throw new ConflictException(`Workspace ${name} already exists`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(workspacePath, { recursive: true });
        this.logger.log(`Workspace created: ${workspacePath}`);
        
        // Create .env file in the root of playwright-workspaces if it doesn't exist
        await this.createRootEnvFile();
        
        return workspacePath;
      }
      throw error;
    }
  }

  /**
   * Creates a .env file in the root of playwright-workspaces with OpenAI API key variable (synchronous).
   * 
   * This method creates a template .env file with OpenAI configuration if it doesn't exist
   * or if the existing file is empty. The file includes placeholders for common environment variables.
   * 
   * @private
   */
  private createRootEnvFileSync(): void {
    try {
      const envFilePath = path.join(this.workspacesDir, '.env');
      
      // Check if .env already exists and has content
      let shouldCreate = false;
      try {
        const stats = require('fs').statSync(envFilePath);
        if (stats.size === 0) {
          this.logger.log(`Root .env file exists but is empty, will recreate: ${envFilePath}`);
          shouldCreate = true;
        } else {
          this.logger.log(`Root .env file already exists: ${envFilePath}`);
          return;
        }
      } catch {
        // File doesn't exist, create it
        shouldCreate = true;
      }
      
      if (shouldCreate) {
        const envContent = `# OpenAI Configuration
# Get your API key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=your-api-key-here

# Other environment variables can be added here
# DATABASE_URL=your-database-url
# REDIS_URL=your-redis-url
`;
        
        require('fs').writeFileSync(envFilePath, envContent, 'utf-8');
        this.logger.log(`Created root .env file: ${envFilePath}`);
      }
    } catch (error) {
      this.logger.warn(`Could not create root .env file: ${error.message}`);
      // Don't throw error, as this is not critical for workspace creation
    }
  }

  /**
   * Creates a .env file in the root of playwright-workspaces with OpenAI API key variable.
   * 
   * This method creates a template .env file with OpenAI configuration if it doesn't exist
   * or if the existing file is empty. The file includes placeholders for common environment variables.
   * 
   * @private
   * @returns Promise that resolves when the .env file is created or already exists
   */
  private async createRootEnvFile(): Promise<void> {
    try {
      const envFilePath = path.join(this.workspacesDir, '.env');
      
      // Check if .env already exists and has content
      let shouldCreate = false;
      try {
        const stats = await fs.stat(envFilePath);
        if (stats.size === 0) {
          this.logger.log(`Root .env file exists but is empty, will recreate: ${envFilePath}`);
          shouldCreate = true;
        } else {
          this.logger.log(`Root .env file already exists: ${envFilePath}`);
          return;
        }
      } catch {
        // File doesn't exist, create it
        shouldCreate = true;
      }
      
      if (shouldCreate) {
        const envContent = `# OpenAI Configuration
# Get your API key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=your-api-key-here

# Other environment variables can be added here
# DATABASE_URL=your-database-url
# REDIS_URL=your-redis-url
`;
        
        await fs.writeFile(envFilePath, envContent, 'utf-8');
        this.logger.log(`Created root .env file: ${envFilePath}`);
      }
    } catch (error) {
      this.logger.warn(`Could not create root .env file: ${error.message}`);
      // Don't throw error, as this is not critical for workspace creation
    }
  }

  /**
   * Lists all available workspaces.
   * 
   * @returns Promise that resolves to an array of workspace names
   * 
   * @example
   * ```typescript
   * const workspaces = await workspaceService.listWorkspaces();
   * console.log('Available workspaces:', workspaces);
   * ```
   */
  async listWorkspaces(): Promise<string[]> {
    const entries = await fs.readdir(this.workspacesDir, {
      withFileTypes: true,
    });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  }

  /**
   * Deletes a workspace with the specified name.
   * 
   * This method attempts to delete the workspace directory with retry logic.
   * It checks for blocked files and provides detailed error information if deletion fails.
   * 
   * @param name - The name of the workspace to delete
   * @returns Promise that resolves when the workspace is successfully deleted
   * @throws {ConflictException} When the workspace cannot be deleted due to files in use
   * 
   * @example
   * ```typescript
   * try {
   *   await workspaceService.deleteWorkspace('old-project');
   *   console.log('Workspace deleted successfully');
   * } catch (error) {
   *   console.error('Failed to delete workspace:', error.message);
   * }
   * ```
   */
  async deleteWorkspace(name: string): Promise<void> {
    const workspacePath = path.join(this.workspacesDir, name);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Check if there are blocked files
        const blockedFiles = await this.findBlockedFiles(workspacePath);
        if (blockedFiles.length > 0) {
          this.logger.warn(
            `Attempt ${attempt}: Blocked files found:`,
            blockedFiles,
          );
          if (attempt === MAX_RETRIES) {
            throw new ConflictException({
              message:
                'Cannot delete workspace because there are files in use.',
              code: 'RESOURCE_BUSY',
              details: {
                workspace: name,
                blockedFiles: blockedFiles.map((file) =>
                  path.relative(workspacePath, file),
                ),
                suggestion: 'Please close all open files and try again.',
              },
            });
          }
          await this.sleep(RETRY_DELAY);
          continue;
        }

        await fs.rm(workspacePath, { recursive: true, force: true });
        this.logger.log(`Workspace deleted: ${workspacePath}`);
        return;
      } catch (error) {
        if (error.code === 'ENOENT') {
          return; // Directory no longer exists
        }

        if (error instanceof ConflictException) {
          throw error; // Re-throw conflict errors
        }

        if (attempt === MAX_RETRIES) {
          if (error.code === 'EBUSY') {
            throw new ConflictException({
              message: 'Cannot delete workspace because it is in use.',
              code: 'RESOURCE_BUSY',
              details: {
                workspace: name,
                suggestion: 'Please close all open files and try again.',
              },
            });
          }
          this.logger.error(
            `Could not delete workspace after ${MAX_RETRIES} attempts`,
          );
          throw error;
        }

        this.logger.warn(
          `Attempt ${attempt}: Error deleting workspace:`,
          error.message,
        );
        await this.sleep(RETRY_DELAY);
      }
    }
  }

  /**
   * Recursively finds files that are currently blocked or in use.
   * 
   * This method checks each file in the directory tree to determine if it can be accessed
   * for writing. Files that are blocked (EBUSY) or have permission issues (EPERM) are
   * considered blocked.
   * 
   * @param dirPath - The directory path to search for blocked files
   * @returns Promise that resolves to an array of blocked file paths
   * @private
   */
  private async findBlockedFiles(dirPath: string): Promise<string[]> {
    const blockedFiles: string[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        try {
          if (entry.isDirectory()) {
            const subDirBlocked = await this.findBlockedFiles(fullPath);
            blockedFiles.push(...subDirBlocked);
          } else {
            // Try to open the file for writing
            const fileHandle = await fs.open(fullPath, 'r+');
            await fileHandle.close();
          }
        } catch (error) {
          if (error.code === 'EBUSY' || error.code === 'EPERM') {
            blockedFiles.push(fullPath);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error searching for blocked files: ${error.message}`);
    }

    return blockedFiles;
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
   * Checks if a workspace with the specified name exists.
   * 
   * @param name - The name of the workspace to check
   * @returns Promise that resolves to true if the workspace exists, false otherwise
   * 
   * @example
   * ```typescript
   * const exists = await workspaceService.workspaceExists('my-project');
   * if (exists) {
   *   console.log('Workspace exists');
   * } else {
   *   console.log('Workspace does not exist');
   * }
   * ```
   */
  async workspaceExists(name: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.workspacesDir, name));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets the full path for a workspace with the specified name.
   * 
   * @param name - The name of the workspace
   * @returns The full path to the workspace directory
   * 
   * @example
   * ```typescript
   * const workspacePath = workspaceService.getWorkspacePath('my-project');
   * console.log(`Workspace path: ${workspacePath}`);
   * ```
   */
  getWorkspacePath(name: string): string {
    return path.join(this.workspacesDir, name);
  }
}
