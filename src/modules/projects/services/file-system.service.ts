import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Service for file system operations.
 * 
 * This service provides utilities for creating directories, writing files,
 * reading files, and creating directory structures for testing projects.
 * It abstracts file system operations and provides a consistent interface
 * for project generation services.
 * 
 * @class FileSystemService
 * @since 1.0.0
 */
@Injectable()
export class FileSystemService {
  /** Logger instance for this service */
  private readonly logger = new Logger(FileSystemService.name);

  /**
   * Creates a directory at the specified path.
   * 
   * @param dirPath - The path where to create the directory
   * @returns Promise that resolves when the directory is created
   * 
   * @example
   * ```typescript
   * await fileSystemService.createDirectory('/path/to/directory');
   * ```
   */
  async createDirectory(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  /**
   * Writes content to a file at the specified path.
   * 
   * @param filePath - The path where to write the file
   * @param content - The content to write to the file
   * @returns Promise that resolves when the file is written
   * 
   * @example
   * ```typescript
   * await fileSystemService.writeFile('/path/to/file.txt', 'Hello World');
   * ```
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    await fs.writeFile(filePath, content, 'utf8');
  }

  /**
   * Reads the content of a file.
   * 
   * @param filePath - The path of the file to read
   * @returns Promise that resolves to the file content
   * 
   * @example
   * ```typescript
   * const content = await fileSystemService.readFile('/path/to/file.txt');
   * console.log(content);
   * ```
   */
  async readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf8');
  }

  /**
   * Creates a complete directory structure from a list of paths.
   * 
   * This method creates both directories and placeholder files based on the
   * provided structure array. Files are identified by having a file extension.
   * 
   * @param basePath - The base path where to create the structure
   * @param structure - Array of relative paths to create
   * @returns Promise that resolves when the structure is created
   * 
   * @example
   * ```typescript
   * const structure = [
   *   'src',
   *   'src/api',
   *   'src/api/BaseApiClient.ts',
   *   'src/features'
   * ];
   * await fileSystemService.createDirectoryStructure('/project/path', structure);
   * ```
   */
  async createDirectoryStructure(
    basePath: string,
    structure: string[],
  ): Promise<void> {
    for (const item of structure) {
      const fullPath = path.join(basePath, item);
      const isFile = path.extname(item) !== '';

      if (isFile) {
        await this.createDirectory(path.dirname(fullPath));
        await this.writeFile(fullPath, '// TODO: Implement this file\n');
      } else {
        await this.createDirectory(fullPath);
      }
    }
  }
}
