import { AITool, CodeInsertion } from '../interfaces/ai-agent.interface';
import * as fs from 'fs';
import * as path from 'path';

export const codeInserterTool: AITool = {
  name: 'codeInserterTool',
  description: 'Inserta código en archivos existentes en las líneas especificadas',
  
  async execute(params: {
    projectPath: string;
    insertions: CodeInsertion[];
  }): Promise<{ success: boolean; modifiedFiles: string[]; errors: string[] }> {
    const { projectPath, insertions } = params;
    
    const modifiedFiles: string[] = [];
    const errors: string[] = [];
    
    for (const insertion of insertions) {
      try {
        const fullPath = path.join(projectPath, insertion.file);
        
        if (!fs.existsSync(fullPath)) {
          errors.push(`Archivo no encontrado: ${insertion.file}`);
          continue;
        }
        
        // Leer archivo actual
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        
        // Insertar código en la línea especificada
        if (insertion.line > lines.length) {
          // Si la línea es mayor que el archivo, agregar al final
          lines.push(insertion.content);
        } else {
          // Insertar en la línea específica (1-indexed to 0-indexed)
          lines.splice(insertion.line - 1, 0, insertion.content);
        }
        
        // Escribir archivo modificado
        const newContent = lines.join('\n');
        fs.writeFileSync(fullPath, newContent, 'utf-8');
        
        modifiedFiles.push(insertion.file);
        
      } catch (error) {
        errors.push(`Error modificando ${insertion.file}: ${error.message}`);
      }
    }
    
    return {
      success: errors.length === 0,
      modifiedFiles,
      errors,
    };
  },
}; 