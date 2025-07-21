import { Injectable, Logger } from '@nestjs/common';
import { GeneratedCode } from '../../../modules/ai/interfaces/ai-agent.interface';

@Injectable()
export class CodeParsingService {
  private readonly logger = new Logger(CodeParsingService.name);

  /**
   * Parsea el código generado por la IA
   */
  parseGeneratedCode(generatedText: string): GeneratedCode {
    this.logger.log(`🔍 Parseando código generado...`);
    
    const code: GeneratedCode = {};
    
    // Buscar código de feature (con o sin dos puntos)
    const featureMatch = generatedText.match(/```gherkin:?([\s\S]*?)```/);
    if (featureMatch) {
      code.feature = featureMatch[1].trim();
      this.logger.log(`✅ Código feature encontrado`);
    } else {
      this.logger.log(`⚠️ No se encontró código feature con formato esperado`);
    }
    
    // Buscar código de steps (con o sin dos puntos)
    const stepsMatch = generatedText.match(/```typescript:?([\s\S]*?)```/);
    if (stepsMatch) {
      code.steps = stepsMatch[1].trim();
      this.logger.log(`✅ Código steps encontrado`);
    } else {
      this.logger.log(`⚠️ No se encontró código steps con formato esperado`);
    }
    
    // Buscar otros tipos de código si es necesario
    const testsMatch = generatedText.match(/```javascript:?([\s\S]*?)```/);
    if (testsMatch) {
      code.tests = testsMatch[1].trim();
      this.logger.log(`✅ Código tests encontrado`);
    }
    
    const fixturesMatch = generatedText.match(/```typescript:?fixtures?([\s\S]*?)```/);
    if (fixturesMatch) {
      code.fixtures = fixturesMatch[1].trim();
      this.logger.log(`✅ Código fixtures encontrado`);
    }
    
    const schemasMatch = generatedText.match(/```typescript:?schemas?([\s\S]*?)```/);
    if (schemasMatch) {
      code.schemas = schemasMatch[1].trim();
      this.logger.log(`✅ Código schemas encontrado`);
    }
    
    const typesMatch = generatedText.match(/```typescript:?types?([\s\S]*?)```/);
    if (typesMatch) {
      code.types = typesMatch[1].trim();
      this.logger.log(`✅ Código types encontrado`);
    }
    
    const clientMatch = generatedText.match(/```typescript:?client?([\s\S]*?)```/);
    if (clientMatch) {
      code.client = clientMatch[1].trim();
      this.logger.log(`✅ Código client encontrado`);
    }
    
    this.logger.log(`📋 Código parseado: ${JSON.stringify(code, null, 2)}`);
    
    return code;
  }

  /**
   * Valida que el código parseado sea válido
   */
  validateParsedCode(code: GeneratedCode): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Verificar que al menos tengamos feature o steps
    if (!code.feature && !code.steps) {
      errors.push('No se encontró código de feature ni steps');
    }
    
    // Validar estructura del feature si existe
    if (code.feature) {
      const featureErrors = this.validateFeatureCode(code.feature);
      errors.push(...featureErrors);
    }
    
    // Validar estructura de steps si existe
    if (code.steps) {
      const stepsErrors = this.validateStepsCode(code.steps);
      errors.push(...stepsErrors);
    }
    
    return { isValid: errors.length === 0, errors };
  }

  /**
   * Valida el código de feature
   */
  private validateFeatureCode(featureCode: string): string[] {
    const errors: string[] = [];
    const lines = featureCode.split('\n');
    
    let hasScenario = false;
    let hasGiven = false;
    let hasWhen = false;
    let hasThen = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('Scenario:')) {
        hasScenario = true;
      } else if (trimmedLine.startsWith('Given')) {
        hasGiven = true;
      } else if (trimmedLine.startsWith('When')) {
        hasWhen = true;
      } else if (trimmedLine.startsWith('Then')) {
        hasThen = true;
      }
    }
    
    if (!hasScenario) {
      errors.push('Feature no contiene escenarios');
    }
    
    if (!hasGiven) {
      errors.push('Feature no contiene pasos Given');
    }
    
    if (!hasWhen) {
      errors.push('Feature no contiene pasos When');
    }
    
    if (!hasThen) {
      errors.push('Feature no contiene pasos Then');
    }
    
    return errors;
  }

  /**
   * Valida el código de steps
   */
  private validateStepsCode(stepsCode: string): string[] {
    const errors: string[] = [];
    const lines = stepsCode.split('\n');
    
    let hasGiven = false;
    let hasWhen = false;
    let hasThen = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('Given(')) {
        hasGiven = true;
      } else if (trimmedLine.startsWith('When(')) {
        hasWhen = true;
      } else if (trimmedLine.startsWith('Then(')) {
        hasThen = true;
      }
    }
    
    if (!hasGiven && !hasWhen && !hasThen) {
      errors.push('Steps no contiene definiciones de Given, When o Then');
    }
    
    return errors;
  }

  /**
   * Limpia el código generado removiendo líneas innecesarias
   */
  cleanGeneratedCode(code: GeneratedCode): GeneratedCode {
    const cleanedCode: GeneratedCode = {};
    
    for (const [key, value] of Object.entries(code)) {
      if (value) {
        cleanedCode[key as keyof GeneratedCode] = this.removeUnnecessaryLines(value);
      }
    }
    
    return cleanedCode;
  }

  /**
   * Remueve líneas innecesarias del código
   */
  private removeUnnecessaryLines(code: string): string {
    const lines = code.split('\n');
    const cleanedLines: string[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Saltar líneas vacías al inicio y final
      if (trimmedLine === '' && (cleanedLines.length === 0 || cleanedLines[cleanedLines.length - 1] === '')) {
        continue;
      }
      
      // Saltar comentarios de archivo
      if (trimmedLine.startsWith('// features/') || trimmedLine.startsWith('// steps/')) {
        continue;
      }
      
      cleanedLines.push(line);
    }
    
    // Remover líneas vacías al final
    while (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1].trim() === '') {
      cleanedLines.pop();
    }
    
    return cleanedLines.join('\n');
  }

  /**
   * Extrae información del código parseado
   */
  extractCodeInfo(code: GeneratedCode): {
    hasFeature: boolean;
    hasSteps: boolean;
    hasTests: boolean;
    hasFixtures: boolean;
    hasSchemas: boolean;
    hasTypes: boolean;
    hasClient: boolean;
    totalLines: number;
  } {
    const info = {
      hasFeature: !!code.feature,
      hasSteps: !!code.steps,
      hasTests: !!code.tests,
      hasFixtures: !!code.fixtures,
      hasSchemas: !!code.schemas,
      hasTypes: !!code.types,
      hasClient: !!code.client,
      totalLines: 0,
    };
    
    let totalLines = 0;
    for (const value of Object.values(code)) {
      if (value) {
        totalLines += value.split('\n').length;
      }
    }
    
    info.totalLines = totalLines;
    
    return info;
  }
} 