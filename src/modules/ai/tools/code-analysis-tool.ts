import { AITool, FileAnalysis } from '../interfaces/ai-agent.interface';
import * as fs from 'fs';
import * as path from 'path';

export const codeAnalysisTool: AITool = {
  name: 'codeAnalysisTool',
  description: 'Analiza archivos existentes para entender la estructura y patrones del proyecto',
  
  async execute(params: {
    projectPath: string;
    entityName: string;
    section: string;
  }): Promise<FileAnalysis[]> {
    const { projectPath, entityName, section } = params;
    
    const analyses: FileAnalysis[] = [];
    
    // Analizar archivos relevantes
    const filesToAnalyze = [
      `src/features/${section}/${entityName.toLowerCase()}.feature`,
      `src/steps/${section}/${entityName.toLowerCase()}.steps.ts`,
      `src/tests/${section}/${entityName.toLowerCase()}.spec.ts`,
    ];
    
    for (const filePath of filesToAnalyze) {
      const fullPath = path.join(projectPath, filePath);
      
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const analysis = analyzeFile(filePath, content);
        analyses.push(analysis);
      }
    }
    
    return analyses;
  },
};

function analyzeFile(filePath: string, content: string): FileAnalysis {
    const lines = content.split('\n');
    const structure = {
      scenarios: [] as Array<{ line: number; name: string }>,
      steps: [] as Array<{ line: number; name: string }>,
      imports: [] as Array<{ line: number; import: string }>,
    };
    
    // Analizar líneas
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      
      // Detectar escenarios
      if (line.trim().startsWith('Scenario:')) {
        const name = line.replace('Scenario:', '').trim();
        structure.scenarios.push({ line: lineNumber, name });
      }
      
      // Detectar steps
      if (line.trim().startsWith('Given(') || 
          line.trim().startsWith('When(') || 
          line.trim().startsWith('Then(')) {
        const name = line.trim();
        structure.steps.push({ line: lineNumber, name });
      }
      
      // Detectar imports
      if (line.trim().startsWith('import ')) {
        structure.imports.push({ line: lineNumber, import: line.trim() });
      }
    });
    
    return {
      filePath,
      content,
      structure,
    };
  } 