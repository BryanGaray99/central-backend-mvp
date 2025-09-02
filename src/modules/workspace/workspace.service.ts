import { Injectable, Logger, ConflictException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);
  private readonly workspacesDir: string;

  constructor() {
    const envPath = process.env.PLAYWRIGHT_WORKSPACES_PATH || '../playwright-workspaces';
    let dir = envPath;
    if (!path.isAbsolute(dir)) {
      dir = path.resolve(process.cwd(), dir);
    }
    // Detecta si la ruta está dentro del backend central
    const backendRoot = path.resolve(__dirname, '../../..');
    if (dir.startsWith(backendRoot)) {
      throw new Error(
        'PLAYWRIGHT_WORKSPACES_PATH no puede estar dentro del backend central.',
      );
    }
    this.workspacesDir = dir;
    
    // Initialize synchronously to ensure .env is created on startup
    this.initSync();
  }

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
   * Creates a .env file in the root of playwright-workspaces with OpenAI API key variable (synchronous)
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
   * Creates a .env file in the root of playwright-workspaces with OpenAI API key variable
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

  async listWorkspaces(): Promise<string[]> {
    const entries = await fs.readdir(this.workspacesDir, {
      withFileTypes: true,
    });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  }

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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async workspaceExists(name: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.workspacesDir, name));
      return true;
    } catch {
      return false;
    }
  }

  getWorkspacePath(name: string): string {
    return path.join(this.workspacesDir, name);
  }
}
