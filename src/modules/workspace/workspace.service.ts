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
    const envPath = process.env.PLAYWRIGHT_WORKSPACES_PATH;
    if (!envPath) {
      throw new Error(
        'PLAYWRIGHT_WORKSPACES_PATH must be defined as an absolute or relative path OUTSIDE the backend central.',
      );
    }
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
    this.init();
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
        return workspacePath;
      }
      throw error;
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
