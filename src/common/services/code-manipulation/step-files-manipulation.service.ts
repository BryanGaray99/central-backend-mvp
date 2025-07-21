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
    if (stepBlocks.given && sectionComments.whenCommentLine >= 0) {
      this.logger.log(`🔍 [${generationId}] Procesando inserción de Given...`);
      this.logger.log(`📍 [${generationId}] Insertando Given antes del comentario "// When steps" en línea ${sectionComments.whenCommentLine + 1}`);
      insertions.push({
        file: filePath,
        line: sectionComments.whenCommentLine + 1,
        content: '\n' + stepBlocks.given,
        type: 'step',
        description: 'Insertar nuevo Given antes del comentario "// When steps"',
      });
    }
    
    if (stepBlocks.when && sectionComments.thenCommentLine >= 0) {
      this.logger.log(`🔍 [${generationId}] Procesando inserción de When...`);
      this.logger.log(`📍 [${generationId}] Insertando When antes del comentario "// Then steps" en línea ${sectionComments.thenCommentLine + 1}`);
      insertions.push({
        file: filePath,
        line: sectionComments.thenCommentLine + 1,
        content: '\n' + stepBlocks.when,
        type: 'step',
        description: 'Insertar nuevo When antes del comentario "// Then steps"',
      });
    }
    
    if (stepBlocks.then) {
      this.logger.log(`🔍 [${generationId}] Procesando inserción de Then...`);
      this.logger.log(`📍 [${generationId}] Insertando Then al final del archivo en línea ${lines.length + 1}`);
      insertions.push({
        file: filePath,
        line: lines.length + 1,
        content: '\n' + stepBlocks.then,
        type: 'step',
        description: 'Insertar nuevo Then al final del archivo',
      });
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
  ): { whenCommentLine: number; thenCommentLine: number } {
    let whenCommentLine = -1;
    let thenCommentLine = -1;
    
    this.logger.log(`🔍 [${generationId}] Buscando comentarios de sección...`);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '// When steps') {
        whenCommentLine = i;
        this.logger.log(`🎯 [${generationId}] Comentario "// When steps" encontrado en línea ${i + 1}`);
      } else if (line === '// Then steps') {
        thenCommentLine = i;
        this.logger.log(`🎯 [${generationId}] Comentario "// Then steps" encontrado en línea ${i + 1}`);
      }
    }
    
    this.logger.log(`📊 [${generationId}] Comentarios encontrados:`);
    this.logger.log(`📊 [${generationId}] - "// When steps": línea ${whenCommentLine >= 0 ? whenCommentLine + 1 : 'NO ENCONTRADO'}`);
    this.logger.log(`📊 [${generationId}] - "// Then steps": línea ${thenCommentLine >= 0 ? thenCommentLine + 1 : 'NO ENCONTRADO'}`);
    
    return { whenCommentLine, thenCommentLine };
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
   * Verifica si un step ya existe en el archivo
   */
  stepExists(filePath: string, stepPattern: string): boolean {
    if (!fs.existsSync(filePath)) {
      return false;
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.trim().includes(stepPattern)) {
        return true;
      }
    }
    
    return false;
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
} 