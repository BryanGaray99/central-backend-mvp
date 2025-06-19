import { Injectable, Logger } from '@nestjs/common';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { Project } from '../project.entity';
import * as fs from 'fs/promises';
import * as path from 'path';

const exec = promisify(execCallback);
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 segundo

@Injectable()
export class PlaywrightService {
  private readonly logger = new Logger(PlaywrightService.name);

  async initializeProject(project: Project): Promise<void> {
    // Inicializar proyecto Playwright con todas las configuraciones básicas
    await this.execCommand(
      'npm init playwright@latest --quiet --yes -- --quiet',
      project.path,
    );

    // Instalar dependencias adicionales para BDD
    await this.execCommand(
      'npm install --save-dev @cucumber/cucumber @cucumber/pretty-formatter @faker-js/faker ajv ajv-formats',
      project.path,
    );

    // Limpiar archivos de ejemplo
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
          // Verificar si el archivo está bloqueado
          try {
            const fileHandle = await fs.open(fullPath, 'r+');
            await fileHandle.close();
          } catch (error) {
            if (error.code === 'EBUSY' || error.code === 'EPERM') {
              this.logger.warn(`Archivo bloqueado en intento ${attempt}: ${file}`);
              if (attempt === MAX_RETRIES) {
                this.logger.error(`No se pudo eliminar archivo bloqueado: ${file}`);
                continue; // Saltamos al siguiente archivo
              }
              await this.sleep(RETRY_DELAY);
              continue;
            }
          }

          await fs.rm(fullPath, { recursive: true, force: true });
          this.logger.debug(`Archivo de ejemplo eliminado: ${file}`);
          break; // Salimos del loop de reintentos si se eliminó correctamente
        } catch (error) {
          if (error.code === 'ENOENT') {
            break; // El archivo ya no existe, continuamos con el siguiente
          }
          
          if (attempt === MAX_RETRIES) {
            this.logger.warn(`No se pudo eliminar ${file}: ${error.message}`);
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
      // Crear un test básico de health check
      const healthTestContent = `
import { test, expect } from '@playwright/test';

test('health check - project setup', async () => {
  // Verificar que la configuración base está correcta
  expect(process.env.npm_package_name).toBe('${project.name}');
  
  // Verificar que podemos importar las dependencias principales
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

      // Ejecutar el test de health check
      await this.execCommand('npx playwright test tests/health.spec.ts', project.path);
      
      return true;
    } catch (error) {
      this.logger.error('Health check falló:', error);
      return false;
    }
  }

  private async execCommand(command: string, cwd: string): Promise<void> {
    try {
      const { stdout, stderr } = await exec(command, { cwd });
      if (stdout) this.logger.debug(stdout);
      if (stderr) this.logger.warn(stderr);
    } catch (error) {
      this.logger.error(`Error ejecutando comando: ${command}`);
      this.logger.error(error);
      throw error;
    }
  }
} 