import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { CodeInsertion } from '../../../modules/ai/interfaces/ai-agent.interface';

@Injectable()
export class FeatureFilesManipulationService {
  private readonly logger = new Logger(FeatureFilesManipulationService.name);

  /**
   * Analiza archivo feature y encuentra la ubicación para insertar
   */
  async analyzeFeatureFile(
    filePath: string, 
    newFeatureCode: string, 
    generationId: string
  ): Promise<CodeInsertion | null> {
    this.logger.log(`🔍 [${generationId}] Analizando archivo feature: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      this.logger.log(`⚠️ [${generationId}] Archivo feature no existe: ${filePath}`);
      return null;
    }
    
    this.logger.log(`📄 [${generationId}] Archivo feature encontrado, leyendo contenido...`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    this.logger.log(`📊 [${generationId}] Archivo feature tiene ${lines.length} líneas`);
    
    // Extraer el test case ID del nuevo código para verificar si ya existe
    const tcIdMatch = newFeatureCode.match(/@TC-[^\s]+/);
    if (tcIdMatch) {
      const testCaseId = tcIdMatch[0];
      this.logger.log(`🔍 [${generationId}] Verificando si el test case ${testCaseId} ya existe...`);
      
      if (content.includes(testCaseId)) {
        this.logger.warn(`⚠️ [${generationId}] El test case ${testCaseId} ya existe en el archivo. No se insertará.`);
        return null; // No insertar si ya existe
      }
    }
    
    // Buscar el último escenario
    const lastScenarioLine = this.findLastScenarioLine(lines, generationId);
    
    // Si no hay escenarios, buscar después del Background o al final del archivo
    let insertLine = lines.length;
    if (lastScenarioLine >= 0) {
      // Insertar después del último escenario
      insertLine = lastScenarioLine + 1;
      this.logger.log(`📍 [${generationId}] Comenzando búsqueda desde línea ${insertLine + 1} (después del último Scenario)`);
      
      // Avanzar hasta encontrar una línea vacía o el final
      while (insertLine < lines.length && lines[insertLine].trim() !== '') {
        this.logger.log(`🔍 [${generationId}] Línea ${insertLine + 1}: "${lines[insertLine].trim()}" (no vacía, continuando...)`);
        insertLine++;
      }
      this.logger.log(`✅ [${generationId}] Encontrada línea vacía o final en línea ${insertLine + 1}`);
    } else {
      // Buscar después del Background
      insertLine = this.findInsertionAfterBackground(lines, generationId);
    }
    
    this.logger.log(`📍 [${generationId}] LÍNEA FINAL DE INSERCIÓN: ${insertLine + 1}`);
    this.logger.log(`📍 [${generationId}] Contenido a insertar: ${newFeatureCode.substring(0, 100)}...`);
    
    return {
      file: filePath,
      line: insertLine + 1, // 1-indexed
      content: '\n' + newFeatureCode,
      type: 'scenario',
      description: 'Insertar nuevo escenario después del último existente',
    };
  }

  /**
   * Busca el último escenario en el archivo feature
   */
  private findLastScenarioLine(lines: string[], generationId: string): number {
    let lastScenarioLine = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().startsWith('Scenario:')) {
        lastScenarioLine = i;
        this.logger.log(`🎯 [${generationId}] Último Scenario encontrado en línea ${i + 1}: "${lines[i].trim()}"`);
        break;
      }
    }
    
    if (lastScenarioLine === -1) {
      this.logger.log(`⚠️ [${generationId}] No se encontraron escenarios en el archivo`);
    }
    
    return lastScenarioLine;
  }

  /**
   * Busca la línea de inserción después del Background
   */
  private findInsertionAfterBackground(lines: string[], generationId: string): number {
    this.logger.log(`🔍 [${generationId}] Buscando Background...`);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('Background:')) {
        this.logger.log(`🎯 [${generationId}] Background encontrado en línea ${i + 1}`);
        let insertLine = i + 1;
        while (insertLine < lines.length && lines[insertLine].trim() !== '') {
          this.logger.log(`🔍 [${generationId}] Línea ${insertLine + 1}: "${lines[insertLine].trim()}" (no vacía, continuando...)`);
          insertLine++;
        }
        this.logger.log(`✅ [${generationId}] Encontrada línea vacía después del Background en línea ${insertLine + 1}`);
        return insertLine;
      }
    }
    
    // Si no hay Background, insertar al final
    return lines.length;
  }

  /**
   * Verifica si un escenario ya existe en el archivo
   */
  scenarioExists(filePath: string, scenarioName: string): boolean {
    if (!fs.existsSync(filePath)) {
      return false;
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.trim().includes(scenarioName)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Obtiene el contenido del archivo feature
   */
  getFeatureContent(filePath: string): string | null {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * Escribe contenido en el archivo feature
   */
  writeFeatureContent(filePath: string, content: string): void {
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * Busca todos los escenarios en el archivo feature
   */
  findAllScenarios(filePath: string): Array<{ line: number; name: string }> {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const scenarios: Array<{ line: number; name: string }> = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('Scenario:')) {
        const name = line.replace('Scenario:', '').trim();
        scenarios.push({ line: i + 1, name });
      }
    }
    
    return scenarios;
  }

  /**
   * Busca el Background en el archivo feature
   */
  findBackground(filePath: string): { line: number; content: string } | null {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('Background:')) {
        return { line: i + 1, content: lines[i].trim() };
      }
    }
    
    return null;
  }

  /**
   * Valida la estructura del archivo feature
   */
  validateFeatureStructure(filePath: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!fs.existsSync(filePath)) {
      errors.push('Archivo no existe');
      return { isValid: false, errors };
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    let hasFeature = false;
    let hasBackground = false;
    let hasScenarios = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('Feature:')) {
        hasFeature = true;
      } else if (trimmedLine.startsWith('Background:')) {
        hasBackground = true;
      } else if (trimmedLine.startsWith('Scenario:')) {
        hasScenarios = true;
      }
    }
    
    if (!hasFeature) {
      errors.push('No se encontró la declaración Feature:');
    }
    
    if (!hasScenarios) {
      errors.push('No se encontraron escenarios');
    }
    
    return { isValid: errors.length === 0, errors };
  }
} 