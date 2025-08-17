import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { CodeInsertion } from '../../../modules/ai/interfaces/ai-agent.interface';

@Injectable()
export class StepFilesManipulationService {
  private readonly logger = new Logger(StepFilesManipulationService.name);

  /**
   * Analiza archivo steps y encuentra las ubicaciones para insertar usando comentarios de sección
   */
  async analyzeStepsFile(
    filePath: string, 
    newStepsCode: string, 
    generationId: string
  ): Promise<CodeInsertion[]> {
    this.logger.log(`🔍 [${generationId}] Analizando archivo steps: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      this.logger.log(`⚠️ [${generationId}] Archivo steps no existe: ${filePath}`);
      return [];
    }
    
    this.logger.log(`📄 [${generationId}] Archivo steps encontrado, leyendo contenido...`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    this.logger.log(`📊 [${generationId}] Archivo steps tiene ${lines.length} líneas`);
    
    // Buscar comentarios de sección
    const sectionComments = this.findSectionComments(lines, generationId);
    
    const insertions: CodeInsertion[] = [];
    
    // Parsear el código de steps para separar Given, When, Then
    this.logger.log(`🔍 [${generationId}] Parseando bloques de steps...`);
    const stepBlocks = this.parseStepBlocks(newStepsCode);
    this.logger.log(`📊 [${generationId}] Bloques encontrados:`);
    this.logger.log(`📊 [${generationId}] - Given: ${stepBlocks.given ? 'SÍ' : 'NO'}`);
    this.logger.log(`📊 [${generationId}] - When: ${stepBlocks.when ? 'SÍ' : 'NO'}`);
    this.logger.log(`📊 [${generationId}] - Then: ${stepBlocks.then ? 'SÍ' : 'NO'}`);
    
    // Insertar cada bloque en su ubicación correspondiente usando comentarios
    if (stepBlocks.given) {
      this.logger.log(`🔍 [${generationId}] Procesando inserción de Given...`);
      
      // Verificar si el step ya existe
      const stepPattern = stepBlocks.given.match(/Given\(['"`]([^'"`]+)['"`]/)?.[1];
      if (stepPattern && this.stepExists(filePath, stepPattern)) {
        this.logger.warn(`⚠️ [${generationId}] Step ya existe: ${stepPattern}`);
        // No insertar el step duplicado
      } else {
        let insertLine = -1;
        
        // Intentar usar la marca "End of Given steps"
        if (sectionComments.givenEndLine >= 0) {
          insertLine = sectionComments.givenEndLine;
          this.logger.log(`📍 [${generationId}] Insertando Given ANTES del comentario "// End of Given steps" en línea ${insertLine + 1}`);
        } else {
          // Método de contingencia: buscar el último Given
          const lastGivenLine = this.findLastStepOfType(lines, 'Given', generationId);
          if (lastGivenLine >= 0) {
            insertLine = lastGivenLine + 1; // Insertar después del último Given
            this.logger.log(`📍 [${generationId}] Insertando Given después del último Given existente en línea ${insertLine + 1}`);
          } else {
            // Si no hay ningún Given, insertar al final del archivo
            insertLine = lines.length;
            this.logger.log(`📍 [${generationId}] No se encontraron Given existentes, insertando al final del archivo en línea ${insertLine + 1}`);
          }
        }
        
        if (insertLine >= 0) {
          insertions.push({
            file: filePath,
            line: insertLine + 1,
            content: '\n' + stepBlocks.given,
            type: 'step',
            description: 'Insertar nuevo Given',
          });
        }
      }
    }
    
    if (stepBlocks.when) {
      this.logger.log(`🔍 [${generationId}] Procesando inserción de When...`);
      
      // Verificar si el step ya existe
      const stepPattern = stepBlocks.when.match(/When\(['"`]([^'"`]+)['"`]/)?.[1];
      if (stepPattern && this.stepExists(filePath, stepPattern)) {
        this.logger.warn(`⚠️ [${generationId}] Step ya existe: ${stepPattern}`);
        // No insertar el step duplicado
      } else {
        let insertLine = -1;
        
        // Intentar usar la marca "End of When steps"
        if (sectionComments.whenEndLine >= 0) {
          insertLine = sectionComments.whenEndLine;
          this.logger.log(`📍 [${generationId}] Insertando When ANTES del comentario "// End of When steps" en línea ${insertLine + 1}`);
        } else {
          // Método de contingencia: buscar el último When
          const lastWhenLine = this.findLastStepOfType(lines, 'When', generationId);
          if (lastWhenLine >= 0) {
            insertLine = lastWhenLine + 1; // Insertar después del último When
            this.logger.log(`📍 [${generationId}] Insertando When después del último When existente en línea ${insertLine + 1}`);
          } else {
            // Si no hay ningún When, insertar al final del archivo
            insertLine = lines.length;
            this.logger.log(`📍 [${generationId}] No se encontraron When existentes, insertando al final del archivo en línea ${insertLine + 1}`);
          }
        }
        
        if (insertLine >= 0) {
          insertions.push({
            file: filePath,
            line: insertLine + 1,
            content: '\n' + stepBlocks.when,
            type: 'step',
            description: 'Insertar nuevo When',
          });
        }
      }
    }
    
    if (stepBlocks.then) {
      this.logger.log(`🔍 [${generationId}] Procesando inserción de Then...`);
      
      // Verificar si el step ya existe
      const stepPattern = stepBlocks.then.match(/Then\(['"`]([^'"`]+)['"`]/)?.[1];
      if (stepPattern && this.stepExists(filePath, stepPattern)) {
        this.logger.warn(`⚠️ [${generationId}] Step ya existe: ${stepPattern}`);
        // No insertar el step duplicado
      } else {
        let insertLine = -1;
        
        // Intentar usar la marca "End of Then steps"
        if (sectionComments.thenCommentLine >= 0) {
          insertLine = sectionComments.thenCommentLine;
          this.logger.log(`📍 [${generationId}] Insertando Then ANTES del comentario "// End of Then steps" en línea ${insertLine + 1}`);
        } else {
          // Método de contingencia: buscar el último Then
          const lastThenLine = this.findLastStepOfType(lines, 'Then', generationId);
          if (lastThenLine >= 0) {
            insertLine = lastThenLine + 1; // Insertar después del último Then
            this.logger.log(`📍 [${generationId}] Insertando Then después del último Then existente en línea ${insertLine + 1}`);
          } else {
            // Si no hay ningún Then, insertar al final del archivo
            insertLine = lines.length;
            this.logger.log(`📍 [${generationId}] No se encontraron Then existentes, insertando al final del archivo en línea ${insertLine + 1}`);
          }
        }
        
        if (insertLine >= 0) {
          insertions.push({
            file: filePath,
            line: insertLine + 1,
            content: '\n' + stepBlocks.then,
            type: 'step',
            description: 'Insertar nuevo Then',
          });
        }
      }
    }
    
    this.logger.log(`📊 [${generationId}] Total de inserciones de steps: ${insertions.length}`);
    for (let i = 0; i < insertions.length; i++) {
      this.logger.log(`📝 [${generationId}] Inserción ${i + 1}: línea ${insertions[i].line} - ${insertions[i].description}`);
    }
    
    return insertions;
  }

  /**
   * Busca comentarios de sección en el archivo steps
   */
  private findSectionComments(
    lines: string[], 
    generationId: string
  ): { whenCommentLine: number; thenCommentLine: number; givenEndLine: number; whenEndLine: number } {
    let whenCommentLine = -1;
    let thenCommentLine = -1;
    let givenEndLine = -1;
    let whenEndLine = -1;
    
    this.logger.log(`🔍 [${generationId}] Buscando comentarios de sección...`);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '// Beginning of When steps') {
        whenCommentLine = i;
        this.logger.log(`🎯 [${generationId}] Comentario "// Beginning of When steps" encontrado en línea ${i + 1}`);
      } else if (line === '// End of Then steps') {
        thenCommentLine = i;
        this.logger.log(`🎯 [${generationId}] Comentario "// End of Then steps" encontrado en línea ${i + 1}`);
      } else if (line === '// End of Given steps') {
        givenEndLine = i;
        this.logger.log(`🎯 [${generationId}] Comentario "// End of Given steps" encontrado en línea ${i + 1}`);
      } else if (line === '// End of When steps') {
        whenEndLine = i;
        this.logger.log(`🎯 [${generationId}] Comentario "// End of When steps" encontrado en línea ${i + 1}`);
      }
    }
    
    this.logger.log(`📊 [${generationId}] Comentarios encontrados:`);
    this.logger.log(`📊 [${generationId}] - "// Beginning of When steps": línea ${whenCommentLine >= 0 ? whenCommentLine + 1 : 'NO ENCONTRADO'}`);
    this.logger.log(`📊 [${generationId}] - "// End of Then steps": línea ${thenCommentLine >= 0 ? thenCommentLine + 1 : 'NO ENCONTRADO'}`);
    this.logger.log(`📊 [${generationId}] - "// End of Given steps": línea ${givenEndLine >= 0 ? givenEndLine + 1 : 'NO ENCONTRADO'}`);
    this.logger.log(`📊 [${generationId}] - "// End of When steps": línea ${whenEndLine >= 0 ? whenEndLine + 1 : 'NO ENCONTRADO'}`);
    
    return { whenCommentLine, thenCommentLine, givenEndLine, whenEndLine };
  }

  /**
   * Encuentra el final de un bloque de step
   */
  findEndOfStepBlock(lines: string[], startLine: number): number {
    let endLine = startLine;
    
    // Avanzar hasta encontrar el final de la función
    while (endLine < lines.length) {
      const line = lines[endLine].trim();
      
      // Si encontramos otro step o el final del archivo
      if ((line.startsWith("Given('") || line.startsWith('Given(') ||
           line.startsWith("When('") || line.startsWith('When(') ||
           line.startsWith("Then('") || line.startsWith('Then(')) && 
          endLine !== startLine) {
        break;
      }
      
      endLine++;
    }
    
    return endLine;
  }

  /**
   * Parsea bloques de steps (Given, When, Then) y remueve imports innecesarios
   */
  parseStepBlocks(stepsCode: string): { given?: string; when?: string; then?: string } {
    const blocks: { given?: string; when?: string; then?: string } = {};
    const lines = stepsCode.split('\n');
    
    let currentBlock: string | null = null;
    let currentContent: string[] = [];
    
    for (const line of lines) {
      // Saltar líneas de import y comentarios de archivo
      if (line.trim().startsWith('import ') || 
          line.trim().startsWith('// steps/') || 
          line.trim().startsWith('// features/')) {
        continue;
      }
      
      if (line.trim().startsWith('Given(')) {
        if (currentBlock && currentContent.length > 0) {
          blocks[currentBlock as keyof typeof blocks] = currentContent.join('\n');
        }
        currentBlock = 'given';
        currentContent = [line];
      } else if (line.trim().startsWith('When(')) {
        if (currentBlock && currentContent.length > 0) {
          blocks[currentBlock as keyof typeof blocks] = currentContent.join('\n');
        }
        currentBlock = 'when';
        currentContent = [line];
      } else if (line.trim().startsWith('Then(')) {
        if (currentBlock && currentContent.length > 0) {
          blocks[currentBlock as keyof typeof blocks] = currentContent.join('\n');
        }
        currentBlock = 'then';
        currentContent = [line];
      } else if (currentBlock) {
        currentContent.push(line);
      }
    }
    
    // Agregar el último bloque
    if (currentBlock && currentContent.length > 0) {
      blocks[currentBlock as keyof typeof blocks] = currentContent.join('\n');
    }
    
    return blocks;
  }

  /**
   * Verifica si un step ya existe en el archivo (mejorada para ignorar parámetros)
   */
  stepExists(filePath: string, stepPattern: string): boolean {
    if (!fs.existsSync(filePath)) {
      return false;
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Limpiar el patrón de parámetros específicos (ej: {int}, 330, etc.)
      const cleanPattern = stepPattern
        .replace(/\{int\}/g, '\\d+')
        .replace(/\{string\}/g, '[^\\s]+')
        .replace(/\{float\}/g, '\\d+\\.\\d+')
        .replace(/\d+/g, '\\d+'); // Reemplazar números específicos con \d+
      
      const escapedPattern = cleanPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?:Given|When|Then|And|But)\\(['"\`][^'"\`]*${escapedPattern}[^'"\`]*['"\`]`);
      
      const exists = regex.test(content);
      if (exists) {
        this.logger.log(`🔍 Step duplicado detectado: ${stepPattern} → ${cleanPattern}`);
      }
      return exists;
    } catch (error) {
      this.logger.warn(`Error verificando step existente: ${error.message}`);
      return false;
    }
  }

  /**
   * Obtiene el contenido del archivo steps
   */
  getStepsContent(filePath: string): string | null {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * Escribe contenido en el archivo steps
   */
  writeStepsContent(filePath: string, content: string): void {
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * Encuentra el último step de un tipo específico como método de contingencia
   */
  private findLastStepOfType(
    lines: string[], 
    stepType: 'Given' | 'When' | 'Then',
    generationId: string
  ): number {
    this.logger.log(`🔍 [${generationId}] Buscando último ${stepType} como método de contingencia...`);
    
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith(`${stepType}(`)) {
        this.logger.log(`🎯 [${generationId}] Último ${stepType} encontrado en línea ${i + 1}: ${line.substring(0, 50)}...`);
        return i;
      }
    }
    
    this.logger.warn(`⚠️ [${generationId}] No se encontró ningún ${stepType} en el archivo`);
    return -1;
  }
} 