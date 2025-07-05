import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  /**
   * Elimina archivos de artefactos y limpia directorios vacíos
   */
  async cleanupEndpointArtifacts(
    projectPath: string,
    artifacts: any,
    section: string,
  ): Promise<void> {
    try {
      // Eliminar archivos de artefactos
      await this.deleteArtifactFiles(projectPath, artifacts);

      // Limpiar directorios vacíos de la sección
      await this.cleanupEmptySectionDirectories(projectPath, section);

      this.logger.log(`Limpieza completada para sección: ${section}`);
    } catch (error) {
      this.logger.error(`Error durante la limpieza: ${error.message}`);
      throw error;
    }
  }

  /**
   * Elimina archivos específicos de artefactos
   */
  private async deleteArtifactFiles(
    projectPath: string,
    artifacts: any,
  ): Promise<void> {
    const filesToDelete = [
      artifacts.feature,
      artifacts.steps,
      artifacts.fixture,
      artifacts.schema,
      artifacts.types,
      artifacts.client,
    ];

    for (const file of filesToDelete) {
      if (file) {
        const filePath = path.join(projectPath, file);
        try {
          await fs.unlink(filePath);
          this.logger.log(`Archivo eliminado: ${file}`);
        } catch (error: any) {
          if (error.code !== 'ENOENT') {
            this.logger.warn(`No se pudo eliminar ${filePath}: ${error.message}`);
          }
        }
      }
    }
  }

  /**
   * Limpia directorios vacíos de una sección específica
   */
  private async cleanupEmptySectionDirectories(
    projectPath: string,
    section: string,
  ): Promise<void> {
    const sectionDirectories = [
      'src/features',
      'src/steps',
      'src/fixtures',
      'src/schemas',
      'src/types',
      'src/api',
    ];

    for (const baseDir of sectionDirectories) {
      const sectionPath = path.join(projectPath, baseDir, section);
      
      try {
        // Verificar si el directorio de la sección existe
        const sectionStats = await fs.stat(sectionPath);
        
        if (sectionStats.isDirectory()) {
          // Verificar si el directorio está vacío
          const files = await fs.readdir(sectionPath);
          
          if (files.length === 0) {
            // Eliminar directorio vacío
            await fs.rmdir(sectionPath);
            this.logger.log(`Directorio vacío eliminado: ${sectionPath}`);
          } else {
            this.logger.log(`Directorio no vacío, manteniendo: ${sectionPath} (${files.length} archivos)`);
          }
        }
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          this.logger.warn(`Error verificando directorio ${sectionPath}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Verifica si una sección está completamente vacía en todos los directorios
   */
  async isSectionEmpty(projectPath: string, section: string): Promise<boolean> {
    const sectionDirectories = [
      'src/features',
      'src/steps',
      'src/fixtures',
      'src/schemas',
      'src/types',
      'src/api',
    ];

    for (const baseDir of sectionDirectories) {
      const sectionPath = path.join(projectPath, baseDir, section);
      
      try {
        const files = await fs.readdir(sectionPath);
        if (files.length > 0) {
          return false; // La sección no está vacía
        }
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          this.logger.warn(`Error verificando directorio ${sectionPath}: ${error.message}`);
        }
      }
    }

    return true; // La sección está completamente vacía
  }

  /**
   * Elimina completamente una sección si está vacía
   */
  async removeEmptySection(projectPath: string, section: string): Promise<void> {
    const isEmpty = await this.isSectionEmpty(projectPath, section);
    
    if (isEmpty) {
      const sectionDirectories = [
        'src/features',
        'src/steps',
        'src/fixtures',
        'src/schemas',
        'src/types',
        'src/api',
      ];

      for (const baseDir of sectionDirectories) {
        const sectionPath = path.join(projectPath, baseDir, section);
        
        try {
          await fs.rmdir(sectionPath);
          this.logger.log(`Sección eliminada: ${sectionPath}`);
        } catch (error: any) {
          if (error.code !== 'ENOENT') {
            this.logger.warn(`Error eliminando directorio ${sectionPath}: ${error.message}`);
          }
        }
      }
      
      this.logger.log(`Sección '${section}' completamente eliminada`);
    } else {
      this.logger.log(`Sección '${section}' no está vacía, manteniendo`);
    }
  }
} 