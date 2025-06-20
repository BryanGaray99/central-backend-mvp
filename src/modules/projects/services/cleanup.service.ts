import { Injectable, Logger } from '@nestjs/common';
import { Project, ProjectStatus } from '../project.entity';
import { WorkspaceService } from '../../workspace/workspace.service';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 segundo

  constructor(private readonly workspaceService: WorkspaceService) {}

  /**
   * Limpia un proyecto en caso de fallo
   */
  async cleanupFailedProject(project: Project, error: Error): Promise<void> {
    this.logger.warn(`Iniciando limpieza del proyecto fallido: ${project.name}`);
    
    try {
      // 1. Limpiar archivos generados parcialmente
      await this.cleanupGeneratedFiles(project);
      
      // 2. Limpiar dependencias instaladas
      await this.cleanupDependencies(project);
      
      // 3. Limpiar archivos temporales
      await this.cleanupTempFiles(project);
      
      // 4. Restaurar estado del proyecto
      await this.restoreProjectState(project);
      
      this.logger.log(`Limpieza completada para el proyecto: ${project.name}`);
      
    } catch (cleanupError) {
      this.logger.error(`Error durante la limpieza del proyecto ${project.name}: ${cleanupError.message}`);
      
      // Si la limpieza falla, intentar eliminar el workspace completo
      await this.emergencyCleanup(project);
    }
  }

  /**
   * Limpia archivos generados parcialmente
   */
  private async cleanupGeneratedFiles(project: Project): Promise<void> {
    const filesToClean = [
      'src/api/api.config.ts',
      'src/steps/hooks.ts',
      'src/steps/world.ts',
      'cucumber.cjs',
      'tests/health.spec.ts'
    ];

    for (const file of filesToClean) {
      const filePath = path.join(project.path, file);
      
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          await fs.unlink(filePath);
          this.logger.debug(`Archivo eliminado: ${file}`);
          break;
        } catch (error: any) {
          if (error.code === 'ENOENT') {
            // El archivo no existe, continuar
            break;
          }
          
          if (attempt === this.maxRetries) {
            this.logger.warn(`No se pudo eliminar ${file}: ${error.message}`);
            break;
          }
          
          await this.sleep(this.retryDelay);
        }
      }
    }
  }

  /**
   * Limpia dependencias instaladas
   */
  private async cleanupDependencies(project: Project): Promise<void> {
    const nodeModulesPath = path.join(project.path, 'node_modules');
    const packageLockPath = path.join(project.path, 'package-lock.json');
    
    try {
      // Eliminar node_modules
      await fs.rm(nodeModulesPath, { recursive: true, force: true });
      this.logger.debug('node_modules eliminado');
      
      // Eliminar package-lock.json
      await fs.unlink(packageLockPath);
      this.logger.debug('package-lock.json eliminado');
      
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        this.logger.warn(`Error limpiando dependencias: ${error.message}`);
      }
    }
  }

  /**
   * Limpia archivos temporales
   */
  private async cleanupTempFiles(project: Project): Promise<void> {
    const tempDirs = [
      'test-results',
      'playwright-report',
      'blob-report',
      '.playwright'
    ];

    for (const dir of tempDirs) {
      const dirPath = path.join(project.path, dir);
      
      try {
        await fs.rm(dirPath, { recursive: true, force: true });
        this.logger.debug(`Directorio temporal eliminado: ${dir}`);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          this.logger.warn(`Error eliminando directorio temporal ${dir}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Restaura el estado del proyecto
   */
  private async restoreProjectState(project: Project): Promise<void> {
    // Restaurar package.json original
    const packageJsonPath = path.join(project.path, 'package.json');
    const originalPackageJson = {
      name: project.name,
      version: "1.0.0",
      description: "Proyecto de pruebas generado automáticamente",
      type: "commonjs",
      scripts: {
        test: "echo \"Error: no test specified\" && exit 1"
      },
      keywords: [],
      author: "",
      license: "ISC"
    };

    try {
      await fs.writeFile(packageJsonPath, JSON.stringify(originalPackageJson, null, 2));
      this.logger.debug('package.json restaurado');
    } catch (error: any) {
      this.logger.warn(`Error restaurando package.json: ${error.message}`);
    }

    // Restaurar playwright.config.ts básico
    const playwrightConfigPath = path.join(project.path, 'playwright.config.ts');
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
      this.logger.debug('playwright.config.ts restaurado');
    } catch (error: any) {
      this.logger.warn(`Error restaurando playwright.config.ts: ${error.message}`);
    }
  }

  /**
   * Limpieza de emergencia - elimina el workspace completo
   */
  private async emergencyCleanup(project: Project): Promise<void> {
    this.logger.error(`Ejecutando limpieza de emergencia para: ${project.name}`);
    
    try {
      await this.workspaceService.deleteWorkspace(project.name);
      this.logger.log(`Workspace eliminado en limpieza de emergencia: ${project.name}`);
    } catch (error: any) {
      this.logger.error(`Error en limpieza de emergencia: ${error.message}`);
    }
  }

  /**
   * Limpia proyectos huérfanos (proyectos que quedaron en estado PENDING por mucho tiempo)
   */
  async cleanupOrphanedProjects(projects: Project[]): Promise<void> {
    const orphanedProjects = projects.filter(project => {
      const timeDiff = Date.now() - project.createdAt.getTime();
      const maxPendingTime = 30 * 60 * 1000; // 30 minutos
      return project.status === ProjectStatus.PENDING && timeDiff > maxPendingTime;
    });

    for (const project of orphanedProjects) {
      this.logger.warn(`Limpiando proyecto huérfano: ${project.name}`);
      await this.cleanupFailedProject(project, new Error('Proyecto huérfano detectado'));
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
