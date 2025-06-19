import { Injectable, Logger, ConflictException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 segundo

@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);
  private readonly workspacesDir: string;

  constructor() {
    this.workspacesDir = process.env.WORKSPACES_DIR || '../playwright-workspaces';
    this.init();
  }

  private async init() {
    try {
      await fs.access(this.workspacesDir);
      this.logger.log(`Usando directorio de workspaces: ${this.workspacesDir}`);
    } catch {
      this.logger.warn(`Directorio de workspaces no encontrado, creando: ${this.workspacesDir}`);
      await fs.mkdir(this.workspacesDir, { recursive: true });
    }
  }

  async createWorkspace(name: string): Promise<string> {
    const workspacePath = path.join(this.workspacesDir, name);
    
    try {
      await fs.access(workspacePath);
      throw new ConflictException(`El workspace ${name} ya existe`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(workspacePath, { recursive: true });
        this.logger.log(`Workspace creado: ${workspacePath}`);
        return workspacePath;
      }
      throw error;
    }
  }

  async listWorkspaces(): Promise<string[]> {
    const entries = await fs.readdir(this.workspacesDir, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  }

  async deleteWorkspace(name: string): Promise<void> {
    const workspacePath = path.join(this.workspacesDir, name);
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Verificar si hay archivos bloqueados
        const blockedFiles = await this.findBlockedFiles(workspacePath);
        if (blockedFiles.length > 0) {
          this.logger.warn(`Intento ${attempt}: Archivos bloqueados encontrados:`, blockedFiles);
          if (attempt === MAX_RETRIES) {
            throw new ConflictException({
              message: 'No se puede eliminar el workspace porque hay archivos en uso.',
              code: 'RESOURCE_BUSY',
              details: {
                workspace: name,
                blockedFiles: blockedFiles.map(file => path.relative(workspacePath, file)),
                suggestion: 'Por favor, cierre todos los archivos abiertos e intente nuevamente.'
              }
            });
          }
          await this.sleep(RETRY_DELAY);
          continue;
        }

        await fs.rm(workspacePath, { recursive: true, force: true });
        this.logger.log(`Workspace eliminado: ${workspacePath}`);
        return;
      } catch (error) {
        if (error.code === 'ENOENT') {
          return; // El directorio ya no existe
        }
        
        if (error instanceof ConflictException) {
          throw error; // Re-lanzar errores de conflicto
        }
        
        if (attempt === MAX_RETRIES) {
          if (error.code === 'EBUSY') {
            throw new ConflictException({
              message: 'No se puede eliminar el workspace porque está en uso.',
              code: 'RESOURCE_BUSY',
              details: {
                workspace: name,
                suggestion: 'Por favor, cierre todos los archivos abiertos e intente nuevamente.'
              }
            });
          }
          this.logger.error(`No se pudo eliminar el workspace después de ${MAX_RETRIES} intentos`);
          throw error;
        }
        
        this.logger.warn(`Intento ${attempt}: Error al eliminar workspace:`, error.message);
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
            // Intentar abrir el archivo para escritura
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
      this.logger.error(`Error al buscar archivos bloqueados: ${error.message}`);
    }
    
    return blockedFiles;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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