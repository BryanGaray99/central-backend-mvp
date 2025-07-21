import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { CodeInsertion } from '../../../modules/ai/interfaces/ai-agent.interface';

@Injectable()
export class CodeInsertionService {
  private readonly logger = new Logger(CodeInsertionService.name);

  /**
   * Inserta código en archivos según las inserciones especificadas
   */
  async insertCode(
    insertions: CodeInsertion[],
    generationId: string
  ): Promise<{ success: boolean; modifiedFiles: string[]; errors: string[] }> {
    this.logger.log(`📝 [${generationId}] Iniciando inserción real de código...`);
    this.logger.log(`📊 [${generationId}] Total de inserciones a procesar: ${insertions.length}`);
    
    const modifiedFiles: string[] = [];
    const errors: string[] = [];
    
    for (let i = 0; i < insertions.length; i++) {
      const insertion = insertions[i];
      this.logger.log(`📝 [${generationId}] Procesando inserción ${i + 1}/${insertions.length}: ${insertion.file} línea ${insertion.line}`);
      this.logger.log(`📝 [${generationId}] Tipo: ${insertion.type}, Descripción: ${insertion.description}`);
      
      try {
        const result = await this.insertSingleCode(insertion, generationId);
        if (result.success) {
          modifiedFiles.push(insertion.file);
        } else {
          errors.push(result.error || 'Error desconocido');
        }
      } catch (error: any) {
        const errorMsg = `Error procesando inserción ${i + 1}: ${error.message}`;
        errors.push(errorMsg);
        this.logger.error(`❌ [${generationId}] ${errorMsg}`);
        this.logger.error(`❌ [${generationId}] Stack trace: ${error.stack}`);
      }
    }
    
    const result = {
      success: errors.length === 0,
      modifiedFiles,
      errors,
    };
    
    this.logger.log(`📊 [${generationId}] Resumen de inserción:`);
    this.logger.log(`📊 [${generationId}] - Archivos modificados: ${modifiedFiles.length}`);
    this.logger.log(`📊 [${generationId}] - Errores: ${errors.length}`);
    this.logger.log(`✅ [${generationId}] Inserción completada: ${JSON.stringify(result, null, 2)}`);
    
    return result;
  }

  /**
   * Inserta código en un solo archivo
   */
  private async insertSingleCode(
    insertion: CodeInsertion,
    generationId: string
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.log(`🔍 [${generationId}] Verificando existencia del archivo: ${insertion.file}`);
    
    if (!fs.existsSync(insertion.file)) {
      const errorMsg = `Archivo no encontrado: ${insertion.file}`;
      this.logger.error(`❌ [${generationId}] ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
    
    this.logger.log(`✅ [${generationId}] Archivo encontrado, leyendo contenido...`);
    
    // Leer archivo actual
    const content = fs.readFileSync(insertion.file, 'utf-8');
    const lines = content.split('\n');
    this.logger.log(`📊 [${generationId}] Archivo tiene ${lines.length} líneas`);
    
    // Insertar código en la línea especificada
    if (insertion.line > lines.length) {
      this.logger.log(`📝 [${generationId}] Línea ${insertion.line} > ${lines.length}, agregando al final del archivo`);
      lines.push(insertion.content);
    } else {
      this.logger.log(`📝 [${generationId}] Insertando en línea ${insertion.line} (índice ${insertion.line - 1})`);
      this.logger.log(`📝 [${generationId}] Contenido a insertar: ${insertion.content.substring(0, 100)}...`);
      lines.splice(insertion.line - 1, 0, insertion.content);
    }
    
    this.logger.log(`📊 [${generationId}] Archivo modificado, ahora tiene ${lines.length} líneas`);
    
    // Escribir archivo modificado
    const newContent = lines.join('\n');
    this.logger.log(`💾 [${generationId}] Escribiendo archivo modificado...`);
    fs.writeFileSync(insertion.file, newContent, 'utf-8');
    
    this.logger.log(`✅ [${generationId}] Insertado exitosamente en: ${insertion.file}`);
    return { success: true };
  }

  /**
   * Valida que una inserción sea válida antes de ejecutarla
   */
  validateInsertion(insertion: CodeInsertion): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!insertion.file) {
      errors.push('Archivo no especificado');
    }
    
    if (!insertion.content) {
      errors.push('Contenido no especificado');
    }
    
    if (insertion.line < 1) {
      errors.push('Línea debe ser mayor a 0');
    }
    
    if (!insertion.type) {
      errors.push('Tipo de inserción no especificado');
    }
    
    return { isValid: errors.length === 0, errors };
  }

  /**
   * Crea un backup del archivo antes de modificarlo
   */
  createBackup(filePath: string, generationId: string): string | null {
    try {
      const backupPath = `${filePath}.backup.${Date.now()}`;
      fs.copyFileSync(filePath, backupPath);
      this.logger.log(`📄 [${generationId}] Backup creado: ${backupPath}`);
      return backupPath;
    } catch (error: any) {
      this.logger.error(`❌ [${generationId}] Error creando backup: ${error.message}`);
      return null;
    }
  }

  /**
   * Restaura un archivo desde su backup
   */
  restoreFromBackup(backupPath: string, originalPath: string, generationId: string): boolean {
    try {
      fs.copyFileSync(backupPath, originalPath);
      this.logger.log(`📄 [${generationId}] Archivo restaurado desde backup: ${backupPath}`);
      return true;
    } catch (error: any) {
      this.logger.error(`❌ [${generationId}] Error restaurando desde backup: ${error.message}`);
      return false;
    }
  }

  /**
   * Elimina un backup
   */
  removeBackup(backupPath: string, generationId: string): boolean {
    try {
      fs.unlinkSync(backupPath);
      this.logger.log(`📄 [${generationId}] Backup eliminado: ${backupPath}`);
      return true;
    } catch (error: any) {
      this.logger.error(`❌ [${generationId}] Error eliminando backup: ${error.message}`);
      return false;
    }
  }

  /**
   * Obtiene estadísticas de las inserciones
   */
  getInsertionStats(insertions: CodeInsertion[]): {
    total: number;
    byType: Record<string, number>;
    files: string[];
  } {
    const stats = {
      total: insertions.length,
      byType: {} as Record<string, number>,
      files: [] as string[],
    };
    
    const uniqueFiles = new Set<string>();
    
    for (const insertion of insertions) {
      // Contar por tipo
      stats.byType[insertion.type] = (stats.byType[insertion.type] || 0) + 1;
      
      // Agregar archivo único
      uniqueFiles.add(insertion.file);
    }
    
    stats.files = Array.from(uniqueFiles);
    
    return stats;
  }
} 