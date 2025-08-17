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
    
    // Buscar código usando el formato específico ***Features:*** y ***Steps:***
    const featuresMatch = generatedText.match(/\*\*\*Features:\*\*\*([\s\S]*?)(?=\*\*\*Steps:\*\*\*|$)/);
    if (featuresMatch) {
      let featureContent = featuresMatch[1].trim();
      
      // Limpiar bloques de markdown si existen
      if (featureContent.includes('```gherkin')) {
        const gherkinMatch = featureContent.match(/```gherkin\s*([\s\S]*?)```/);
        if (gherkinMatch) {
          featureContent = gherkinMatch[1].trim();
        }
      } else if (featureContent.includes('```')) {
        const codeMatch = featureContent.match(/```\s*([\s\S]*?)```/);
        if (codeMatch) {
          featureContent = codeMatch[1].trim();
        }
      }
      
      code.feature = featureContent;
      this.logger.log(`✅ Código feature encontrado (formato ***Features:***)`);
      this.logger.log(`📄 Feature content (primeros 200 chars): ${featureContent.substring(0, 200)}...`);
    } else {
      this.logger.log(`⚠️ No se encontró código feature con formato ***Features:***`);
    }
    
    const stepsMatch = generatedText.match(/\*\*\*Steps:\*\*\*([\s\S]*?)(?=\*\*\*Features:\*\*\*|$)/);
    if (stepsMatch) {
      let stepsContent = stepsMatch[1].trim();
      
      // Limpiar bloques de markdown si existen
      if (stepsContent.includes('```typescript')) {
        const typescriptMatch = stepsContent.match(/```typescript\s*([\s\S]*?)```/);
        if (typescriptMatch) {
          stepsContent = typescriptMatch[1].trim();
        }
      } else if (stepsContent.includes('```')) {
        const codeMatch = stepsContent.match(/```\s*([\s\S]*?)```/);
        if (codeMatch) {
          stepsContent = codeMatch[1].trim();
        }
      }
      
      code.steps = stepsContent;
      this.logger.log(`✅ Código steps encontrado (formato ***Steps:***)`);
      this.logger.log(`📄 Steps content (primeros 200 chars): ${stepsContent.substring(0, 200)}...`);
    } else {
      this.logger.log(`⚠️ No se encontró código steps con formato ***Steps:***`);
    }
    
    // Validar que el feature contiene @TC-
    if (code.feature && !code.feature.includes('@TC-')) {
      this.logger.warn(`⚠️ El código feature no contiene @TC-: ${code.feature.substring(0, 100)}...`);
    }
    
    // Validar que el steps contiene Given/When/Then
    if (code.steps) {
      const hasStepDefinition = code.steps.includes('Given(') || code.steps.includes('When(') || code.steps.includes('Then(');
      if (!hasStepDefinition) {
        this.logger.warn(`⚠️ El código steps no contiene definiciones Given/When/Then: ${code.steps.substring(0, 100)}...`);
      }
    }
    
    // Fallback: buscar código de feature (múltiples formatos) si no se encontró con el formato específico
    if (!code.feature) {
      let featureMatch = generatedText.match(/```gherkin:?([\s\S]*?)```/);
      if (!featureMatch) {
        // Buscar sin bloques de markdown, solo el escenario
        featureMatch = generatedText.match(/(?:Scenario:|@TC-.*?\nScenario:)([\s\S]*?)(?=\n\n|\n\/\/|\nGiven\(|$)/);
      }
      if (!featureMatch) {
        // Buscar cualquier línea que contenga "Scenario:"
        const scenarioLines = generatedText.split('\n').filter(line => line.includes('Scenario:'));
        if (scenarioLines.length > 0) {
          const scenarioIndex = generatedText.indexOf(scenarioLines[0]);
          const nextSection = generatedText.indexOf('\n\n', scenarioIndex);
          const endIndex = nextSection > -1 ? nextSection : generatedText.length;
          code.feature = generatedText.substring(scenarioIndex, endIndex).trim();
          this.logger.log(`✅ Código feature encontrado (formato libre)`);
        }
      } else {
        code.feature = featureMatch[1].trim();
        this.logger.log(`✅ Código feature encontrado (formato markdown)`);
      }
      
      // Si no se encontró feature, buscar en el texto completo
      if (!code.feature) {
        // Buscar el patrón completo del escenario con tags
        const fullScenarioMatch = generatedText.match(/(@\w+[^\n]*\n)*@TC-[^\n]*\nScenario:[^\n]*\n((?:  [^\n]*\n)*)/);
        if (fullScenarioMatch) {
          code.feature = fullScenarioMatch[0].trim();
          this.logger.log(`✅ Código feature encontrado (patrón completo)`);
        } else {
          this.logger.log(`⚠️ No se encontró código feature con formato esperado`);
        }
      }
    }
    
    // Fallback: buscar código de steps (múltiples formatos) si no se encontró con el formato específico
    if (!code.steps) {
      let stepsMatch = generatedText.match(/```typescript:?([\s\S]*?)```/);
      if (!stepsMatch) {
        // Buscar sin bloques de markdown, solo el step
        stepsMatch = generatedText.match(/(?:Given\(|When\(|Then\()([\s\S]*?)(?=\n\n|\n\/\/|\nGiven\(|\nWhen\(|\nThen\(|$)/);
      }
      if (!stepsMatch) {
        // Buscar cualquier línea que contenga "Given(", "When(", "Then("
        const stepLines = generatedText.split('\n').filter(line => 
          line.includes('Given(') || line.includes('When(') || line.includes('Then(')
        );
        if (stepLines.length > 0) {
          const stepIndex = generatedText.indexOf(stepLines[0]);
          const nextSection = generatedText.indexOf('\n\n', stepIndex);
          const endIndex = nextSection > -1 ? nextSection : generatedText.length;
          code.steps = generatedText.substring(stepIndex, endIndex).trim();
          this.logger.log(`✅ Código steps encontrado (formato libre)`);
        }
      } else {
        code.steps = stepsMatch[1].trim();
        this.logger.log(`✅ Código steps encontrado (formato markdown)`);
      }
      
      // Si no se encontró steps, buscar en el texto completo
      if (!code.steps) {
        // Buscar el patrón completo del step con Given/When/Then
        const fullStepMatch = generatedText.match(/Given\([^)]*\)[^}]*}/);
        if (fullStepMatch) {
          code.steps = fullStepMatch[0].trim();
          this.logger.log(`✅ Código steps encontrado (patrón completo)`);
        } else {
          this.logger.log(`⚠️ No se encontró código steps con formato esperado`);
        }
      }
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