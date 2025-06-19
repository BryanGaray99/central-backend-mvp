import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class FileSystemService {
  private readonly logger = new Logger(FileSystemService.name);

  async createDirectory(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    await fs.writeFile(filePath, content, 'utf8');
  }

  async createDirectoryStructure(basePath: string, structure: string[]): Promise<void> {
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