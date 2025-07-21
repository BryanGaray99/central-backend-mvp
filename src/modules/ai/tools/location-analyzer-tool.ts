import { AITool, CodeInsertion } from '../interfaces/ai-agent.interface';

export const locationAnalyzerTool: AITool = {
  name: 'locationAnalyzerTool',
  description: 'Analiza dónde insertar código nuevo en archivos existentes',
  
  async execute(params: {
    existingFiles: Array<{ filePath: string; content: string }>;
    newCode: any;
  }): Promise<CodeInsertion[]> {
    const { existingFiles, newCode } = params;
    
    const insertions: CodeInsertion[] = [];
    
    // Esta herramienta será llamada por el agente de IA
    // El agente analizará los archivos y determinará las ubicaciones exactas
    // Aquí solo definimos la estructura de respuesta
    
    for (const file of existingFiles) {
      if (file.filePath.endsWith('.feature')) {
        insertions.push({
          file: file.filePath,
          line: 45, // Línea donde insertar escenario
          content: newCode.feature || '',
          type: 'scenario',
          description: 'Insertar nuevo escenario después de los existentes',
        });
      } else if (file.filePath.endsWith('.steps.ts')) {
        insertions.push({
          file: file.filePath,
          line: 120, // Línea donde insertar step
          content: newCode.steps || '',
          type: 'step',
          description: 'Insertar nuevo step después de los existentes',
        });
      }
    }
    
    return insertions;
  },
}; 