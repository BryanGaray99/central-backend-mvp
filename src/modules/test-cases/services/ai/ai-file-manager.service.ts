import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';

@Injectable()
export class AIFileManagerService {
  private readonly logger = new Logger(AIFileManagerService.name);

  /**
   * Inserta el código generado automáticamente en los archivos del proyecto
   */
  async insertGeneratedCodeIntoProject(
    projectPath: string,
    entityName: string,
    method: string,
    generatedCode: string,
    projectName: string
  ): Promise<{
    featureFileUpdated: boolean;
    stepsFileUpdated: boolean;
    filesModified: string[];
    newScenarios: string[];
  }> {
    try {
      const filesModified: string[] = [];
      const newScenarios: string[] = [];

      // 1. Extraer escenarios del código generado
      const scenarios = this.extractScenariosFromGeneratedCode(generatedCode);
      newScenarios.push(...scenarios);

      // 2. Actualizar feature file existente
      const featureFileUpdated = await this.updateFeatureFile(
        projectPath,
        entityName,
        scenarios
      );
      if (featureFileUpdated) {
        filesModified.push(`src/features/ecommerce/${entityName.toLowerCase()}.feature`);
      }

      // 3. Actualizar steps file si es necesario
      const stepsFileUpdated = await this.updateStepsFile(
        projectPath,
        entityName,
        generatedCode
      );
      if (stepsFileUpdated) {
        filesModified.push(`src/steps/ecommerce/${entityName.toLowerCase()}.steps.ts`);
      }

      // 4. Actualizar fixtures si es necesario
      const fixturesUpdated = await this.updateFixturesFile(
        projectPath,
        entityName,
        generatedCode
      );
      if (fixturesUpdated) {
        filesModified.push(`src/fixtures/ecommerce/${entityName.toLowerCase()}.fixture.ts`);
      }

      // 5. Actualizar schemas si es necesario
      const schemasUpdated = await this.updateSchemasFile(
        projectPath,
        entityName,
        generatedCode
      );
      if (schemasUpdated) {
        filesModified.push(`src/schemas/ecommerce/${entityName.toLowerCase()}.schema.ts`);
      }

      return {
        featureFileUpdated,
        stepsFileUpdated,
        filesModified,
        newScenarios,
      };
    } catch (error) {
      this.logger.error('Error al insertar código generado:', error.message);
      throw new Error(`Error al insertar código: ${error.message}`);
    }
  }

  /**
   * Extrae escenarios del código generado por IA
   */
  private extractScenariosFromGeneratedCode(generatedCode: string): string[] {
    const scenarios: string[] = [];
    
    // Buscar patrones de escenarios en el código generado
    const scenarioMatches = generatedCode.match(/Scenario[^:]*:\s*([^\n]+)/g);
    if (scenarioMatches) {
      scenarioMatches.forEach(match => {
        const scenarioName = match.replace(/Scenario[^:]*:\s*/, '').trim();
        if (scenarioName) {
          scenarios.push(scenarioName);
        }
      });
    }

    return scenarios;
  }

  /**
   * Actualiza el archivo feature existente con nuevos escenarios
   */
  private async updateFeatureFile(
    projectPath: string,
    entityName: string,
    newScenarios: string[]
  ): Promise<boolean> {
    try {
      const featureFilePath = path.join(
        projectPath,
        'src',
        'features',
        'ecommerce',
        `${entityName.toLowerCase()}.feature`
      );

      // Verificar si el archivo existe
      if (!existsSync(featureFilePath)) {
        this.logger.warn(`Feature file no encontrado: ${featureFilePath}`);
        return false;
      }

      // Leer contenido actual
      const currentContent = await fs.readFile(featureFilePath, 'utf8');

      // Generar nuevos escenarios en formato Gherkin
      const newScenariosContent = this.generateGherkinScenarios(entityName, newScenarios);

      // Insertar nuevos escenarios antes del final del archivo
      const updatedContent = this.insertScenariosIntoFeatureFile(currentContent, newScenariosContent);

      // Guardar archivo actualizado
      await fs.writeFile(featureFilePath, updatedContent, 'utf8');

      this.logger.log(`Feature file actualizado: ${featureFilePath}`);
      return true;
    } catch (error) {
      this.logger.error('Error al actualizar feature file:', error.message);
      return false;
    }
  }

  /**
   * Genera escenarios en formato Gherkin
   */
  private generateGherkinScenarios(entityName: string, scenarios: string[]): string {
    let gherkinContent = '\n';

    scenarios.forEach((scenario, index) => {
      const scenarioId = `TC-${entityName.toLowerCase()}-${Date.now()}-${index + 1}`;
      
      gherkinContent += `  @create @positive @smoke\n`;
      gherkinContent += `  @${scenarioId}\n`;
      gherkinContent += `  Scenario: ${scenario}\n`;
      gherkinContent += `    Given I have valid ${entityName} data\n`;
      gherkinContent += `    When I create a ${entityName}\n`;
      gherkinContent += `    Then the ${entityName} should be created successfully\n`;
      gherkinContent += `    And I should receive a 201 status code\n`;
      gherkinContent += `    And the response should contain valid ${entityName} data\n\n`;
    });

    return gherkinContent;
  }

  /**
   * Inserta escenarios en el archivo feature existente
   */
  private insertScenariosIntoFeatureFile(currentContent: string, newScenariosContent: string): string {
    // Buscar la posición antes del último escenario o al final del archivo
    const lines = currentContent.split('\n');
    let insertPosition = lines.length - 1;

    // Buscar el último escenario
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].includes('Scenario:')) {
        insertPosition = i + 1;
        break;
      }
    }

    // Insertar nuevos escenarios
    lines.splice(insertPosition, 0, newScenariosContent);

    return lines.join('\n');
  }

  /**
   * Actualiza el archivo de steps si es necesario
   */
  private async updateStepsFile(
    projectPath: string,
    entityName: string,
    generatedCode: string
  ): Promise<boolean> {
    try {
      const stepsFilePath = path.join(
        projectPath,
        'src',
        'steps',
        'ecommerce',
        `${entityName.toLowerCase()}.steps.ts`
      );

      // Verificar si el archivo existe
      if (!existsSync(stepsFilePath)) {
        this.logger.warn(`Steps file no encontrado: ${stepsFilePath}`);
        return false;
      }

      // Extraer steps del código generado
      const newSteps = this.extractStepsFromGeneratedCode(generatedCode);
      if (newSteps.length === 0) {
        return false;
      }

      // Leer contenido actual
      const currentContent = await fs.readFile(stepsFilePath, 'utf8');

      // Insertar nuevos steps
      const updatedContent = this.insertStepsIntoStepsFile(currentContent, newSteps);

      // Guardar archivo actualizado
      await fs.writeFile(stepsFilePath, updatedContent, 'utf8');

      this.logger.log(`Steps file actualizado: ${stepsFilePath}`);
      return true;
    } catch (error) {
      this.logger.error('Error al actualizar steps file:', error.message);
      return false;
    }
  }

  /**
   * Extrae steps del código generado
   */
  private extractStepsFromGeneratedCode(generatedCode: string): string[] {
    const steps: string[] = [];
    
    // Buscar patrones de steps en el código generado
    const stepMatches = generatedCode.match(/Given\([^)]+\)|When\([^)]+\)|Then\([^)]+\)/g);
    if (stepMatches) {
      stepMatches.forEach(match => {
        if (!steps.includes(match)) {
          steps.push(match);
        }
      });
    }

    return steps;
  }

  /**
   * Inserta steps en el archivo de steps existente
   */
  private insertStepsIntoStepsFile(currentContent: string, newSteps: string[]): string {
    // Buscar la posición al final del archivo, antes de la última llave de cierre
    const lines = currentContent.split('\n');
    let insertPosition = lines.length - 1;

    // Buscar la última llave de cierre
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim() === '}') {
        insertPosition = i;
        break;
      }
    }

    // Generar contenido de nuevos steps
    const newStepsContent = newSteps.map(step => `  ${step}`).join('\n\n');

    // Insertar nuevos steps
    lines.splice(insertPosition, 0, newStepsContent);

    return lines.join('\n');
  }

  /**
   * Actualiza el archivo de fixtures si es necesario
   */
  private async updateFixturesFile(
    projectPath: string,
    entityName: string,
    generatedCode: string
  ): Promise<boolean> {
    try {
      const fixturesFilePath = path.join(
        projectPath,
        'src',
        'fixtures',
        'ecommerce',
        `${entityName.toLowerCase()}.fixture.ts`
      );

      // Verificar si el archivo existe
      if (!existsSync(fixturesFilePath)) {
        this.logger.warn(`Fixtures file no encontrado: ${fixturesFilePath}`);
        return false;
      }

      // Extraer fixtures del código generado
      const newFixtures = this.extractFixturesFromGeneratedCode(generatedCode);
      if (newFixtures.length === 0) {
        return false;
      }

      // Leer contenido actual
      const currentContent = await fs.readFile(fixturesFilePath, 'utf8');

      // Insertar nuevos fixtures
      const updatedContent = this.insertFixturesIntoFixturesFile(currentContent, newFixtures);

      // Guardar archivo actualizado
      await fs.writeFile(fixturesFilePath, updatedContent, 'utf8');

      this.logger.log(`Fixtures file actualizado: ${fixturesFilePath}`);
      return true;
    } catch (error) {
      this.logger.error('Error al actualizar fixtures file:', error.message);
      return false;
    }
  }

  /**
   * Extrae fixtures del código generado
   */
  private extractFixturesFromGeneratedCode(generatedCode: string): string[] {
    const fixtures: string[] = [];
    
    // Buscar patrones de fixtures en el código generado
    const fixtureMatches = generatedCode.match(/export\s+const\s+\w+Fixture\s*=\s*{[^}]+}/g);
    if (fixtureMatches) {
      fixtureMatches.forEach(match => {
        if (!fixtures.includes(match)) {
          fixtures.push(match);
        }
      });
    }

    return fixtures;
  }

  /**
   * Inserta fixtures en el archivo de fixtures existente
   */
  private insertFixturesIntoFixturesFile(currentContent: string, newFixtures: string[]): string {
    // Buscar la posición al final del archivo
    const lines = currentContent.split('\n');
    const insertPosition = lines.length;

    // Generar contenido de nuevos fixtures
    const newFixturesContent = newFixtures.join('\n\n');

    // Insertar nuevos fixtures
    lines.splice(insertPosition, 0, newFixturesContent);

    return lines.join('\n');
  }

  /**
   * Actualiza el archivo de schemas si es necesario
   */
  private async updateSchemasFile(
    projectPath: string,
    entityName: string,
    generatedCode: string
  ): Promise<boolean> {
    try {
      const schemasFilePath = path.join(
        projectPath,
        'src',
        'schemas',
        'ecommerce',
        `${entityName.toLowerCase()}.schema.ts`
      );

      // Verificar si el archivo existe
      if (!existsSync(schemasFilePath)) {
        this.logger.warn(`Schemas file no encontrado: ${schemasFilePath}`);
        return false;
      }

      // Extraer schemas del código generado
      const newSchemas = this.extractSchemasFromGeneratedCode(generatedCode);
      if (newSchemas.length === 0) {
        return false;
      }

      // Leer contenido actual
      const currentContent = await fs.readFile(schemasFilePath, 'utf8');

      // Insertar nuevos schemas
      const updatedContent = this.insertSchemasIntoSchemasFile(currentContent, newSchemas);

      // Guardar archivo actualizado
      await fs.writeFile(schemasFilePath, updatedContent, 'utf8');

      this.logger.log(`Schemas file actualizado: ${schemasFilePath}`);
      return true;
    } catch (error) {
      this.logger.error('Error al actualizar schemas file:', error.message);
      return false;
    }
  }

  /**
   * Extrae schemas del código generado
   */
  private extractSchemasFromGeneratedCode(generatedCode: string): string[] {
    const schemas: string[] = [];
    
    // Buscar patrones de schemas en el código generado
    const schemaMatches = generatedCode.match(/export\s+const\s+\w+Schema\s*=\s*{[^}]+}/g);
    if (schemaMatches) {
      schemaMatches.forEach(match => {
        if (!schemas.includes(match)) {
          schemas.push(match);
        }
      });
    }

    return schemas;
  }

  /**
   * Inserta schemas en el archivo de schemas existente
   */
  private insertSchemasIntoSchemasFile(currentContent: string, newSchemas: string[]): string {
    // Buscar la posición al final del archivo
    const lines = currentContent.split('\n');
    const insertPosition = lines.length;

    // Generar contenido de nuevos schemas
    const newSchemasContent = newSchemas.join('\n\n');

    // Insertar nuevos schemas
    lines.splice(insertPosition, 0, newSchemasContent);

    return lines.join('\n');
  }
} 