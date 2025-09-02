import { Injectable, Logger } from '@nestjs/common';
import { ExecuteTestsDto } from '../dto/execute-tests.dto';
import { TestResultsListenerService } from './test-results-listener.service';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

@Injectable()
export class TestRunnerService {
  private readonly logger = new Logger(TestRunnerService.name);

  constructor(
    private readonly testResultsListenerService: TestResultsListenerService,
  ) {}

  async runPlaywrightTests(projectPath: string, dto: ExecuteTestsDto) {
    this.logger.log(`Ejecutando pruebas de Playwright para entidad: ${dto.entityName}`);

    const startTime = Date.now();
    const results: any[] = [];

    try {
      // Asegurar que el directorio test-results existe
      const testResultsDir = path.join(projectPath, 'test-results');
      try {
        await fs.mkdir(testResultsDir, { recursive: true });
      } catch (error) {
        this.logger.warn(`No se pudo crear el directorio test-results: ${error.message}`);
      }
      
      // Configurar variables de entorno para la ejecución
      const env = {
        ...process.env,
        TEST_ENTITY: dto.entityName,
        TEST_METHOD: dto.method || '',
        TEST_TYPE: dto.testType,
        TEST_TAGS: dto.tags?.join(',') || '',
        TEST_SCENARIO: dto.specificScenario || '',
        TEST_ENVIRONMENT: dto.environment,
        TEST_VERBOSE: dto.verbose?.toString(),
        TEST_SAVE_LOGS: dto.saveLogs?.toString(),
        TEST_SAVE_PAYLOADS: dto.savePayloads?.toString(),
        TEST_TIMEOUT: dto.timeout?.toString(),
        TEST_RETRIES: dto.retries?.toString(),
        // Configurar workers para Playwright (no para Cucumber)
        WORKERS: dto.parallel && dto.workers ? dto.workers.toString() : '1',
        CI: 'false', // Asegurar que no se ejecute en modo CI para permitir workers
      };

      // Construir comando de ejecución
      const command = this.buildExecutionCommand(dto);
      
      let testResults = '';
      let executionError: Error | null = null;
      
      try {
        // Ejecutar pruebas
        testResults = await this.executePlaywrightCommand(projectPath, command, env);
      } catch (error) {
        executionError = error;
        this.logger.error(`Comando falló: ${error.message}`);
        // Continuar para intentar parsear el reporte JSON incluso si falló
      }
      
      // Siempre intentar parsear resultados, incluso si el comando falló
      const parsedResults = await this.parseCucumberOutput(projectPath);
      
      // Calcular estadísticas
      const totalScenarios = parsedResults.length;
      const passedScenarios = parsedResults.filter(r => r.status === 'passed').length;
      const failedScenarios = parsedResults.filter(r => r.status === 'failed').length;

      // Si no se pudieron parsear resultados pero el comando fue exitoso, asumir que pasó
      if (totalScenarios === 0 && testResults && !executionError) {
        this.logger.log('No se pudieron parsear resultados específicos, pero la ejecución fue exitosa');
      }

      const executionTime = Date.now() - startTime;

      // Si hubo un error de ejecución, lanzarlo después de procesar los resultados
      if (executionError) {
        // Crear un error más detallado con la información parseada
        const errorMessage = parsedResults.length > 0 
          ? `Ejecución fallida. ${failedScenarios} escenarios fallaron. Detalles: ${parsedResults.filter(r => r.status === 'failed').map(r => r.errorMessage).join('; ')}`
          : executionError.message;
        
        const detailedError = new Error(errorMessage);
        detailedError.stack = executionError.stack;
        throw detailedError;
      }

      return {
        totalScenarios,
        passedScenarios,
        failedScenarios,
        executionTime,
        results: parsedResults,
      };
    } catch (error) {
      this.logger.error(`Error ejecutando pruebas: ${error.message}`);
      throw error;
    }
  }

  private buildExecutionCommand(dto: ExecuteTestsDto): string {
    let command = 'npx cucumber-js';

    // Usar la configuración base del proyecto
    command += ' src/features/**/*.feature';
    command += ' --require-module ts-node/register';
    command += ' --require src/steps/**/*.ts';
    command += ' --require src/steps/hooks.ts';

    // Filtrar por entidad específica si se proporciona
    if (dto.entityName) {
      command = `npx cucumber-js src/features/ecommerce/${dto.entityName.toLowerCase()}.feature`;
      command += ' --require-module ts-node/register';
      command += ' --require src/steps/**/*.ts';
      command += ' --require src/steps/hooks.ts';
    }

    // Filtrar por escenario específico (prioridad sobre tags)
    if (dto.specificScenario) {
      // Si hay múltiples escenarios separados por coma, crear múltiples filtros --name
      const scenarios = dto.specificScenario.split(',').map(s => s.trim());
      if (scenarios.length === 1) {
        command += ` --name "${scenarios[0]}"`;
      } else {
        // Para múltiples escenarios, usar múltiples filtros --name
        const nameFilters = scenarios.map(scenario => `--name "${scenario}"`).join(' ');
        command += ` ${nameFilters}`;
      }
    } else {
      // Solo usar tags si no hay escenarios específicos
      if (dto.tags && dto.tags.length > 0) {
        const tagFilter = dto.tags.map(tag => `--tags "${tag}"`).join(' ');
        command += ` ${tagFilter}`;
      }
    }

    // Configuración de retries (opción válida en Cucumber.js)
    if (dto.retries && dto.retries > 0) {
      command += ` --retry ${dto.retries}`;
    }

    // Formato de salida
    command += ' --format @cucumber/pretty-formatter';
    command += ' --format json:test-results/cucumber-report.json';

    // Configuración de paralelismo (cucumber-js no soporta --parallel-workers, se maneja a través de configuración)
    // El paralelismo se puede configurar a través de variables de entorno o configuración de Playwright
    if (dto.parallel && dto.workers && dto.workers > 1) {
      // En lugar de usar --parallel-workers, configuramos a través de variables de entorno
      // que serán leídas por la configuración de Playwright
      this.logger.log(`Configurando ejecución paralela con ${dto.workers} workers`);
    }

    // Timeout se maneja a través de variables de entorno o configuración de Playwright
    // No se pasa como parámetro de línea de comandos a Cucumber

    this.logger.log(`Comando generado: ${command}`);
    this.logger.log(`Filtros aplicados:`);
    this.logger.log(`  - Specific scenarios: ${dto.specificScenario || 'none'}`);
    this.logger.log(`  - Tags: ${dto.tags?.join(', ') || 'none'}`);
    this.logger.log(`  - Entity: ${dto.entityName}`);
    return command;
  }

  private async executePlaywrightCommand(projectPath: string, command: string, env: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, [], {
        cwd: projectPath,
        env,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
        // Resumir logs: solo mostrar nombre del escenario y si pasó o falló
        const lines = data.toString().split('\n');
        for (const line of lines) {
          // Detectar líneas de resultado de escenario
          if (/^✅\s+Scenario:/.test(line)) {
            // Escenario pasado
            const match = line.match(/^✅\s+Scenario: (.+)$/);
            if (match) {
              this.logger.log(`✅ PASSED: ${match[1]}`);
            }
          } else if (/^❌\s+Scenario:/.test(line)) {
            // Escenario fallido
            const match = line.match(/^❌\s+Scenario: (.+)$/);
            if (match) {
              this.logger.error(`❌ FAILED: ${match[1]}`);
            }
          } else if (/^Scenario:/.test(line)) {
            // Si hay línea de escenario sin símbolo, mostrar como info
            const match = line.match(/^Scenario: (.+)$/);
            if (match) {
              this.logger.log(`Escenario: ${match[1]}`);
            }
          }
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
        this.logger.debug(`STDERR: ${data.toString()}`);
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Comando falló con código ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Error ejecutando comando: ${error.message}`));
      });
    });
  }

  public async parseCucumberOutput(projectPath: string): Promise<any[]> {
    try {
      // Leer el archivo JSON generado por Cucumber
      const jsonReportPath = path.join(projectPath, 'test-results', 'cucumber-report.json');
      
      try {
        // Verificar si el archivo existe
        await fs.access(jsonReportPath);
        
        const jsonContent = await fs.readFile(jsonReportPath, 'utf8');
        
        if (!jsonContent.trim()) {
          this.logger.warn('El archivo JSON de Cucumber está vacío');
          return [];
        }
        
        const jsonOutput = JSON.parse(jsonContent);
        
        if (!Array.isArray(jsonOutput)) {
          this.logger.warn('El archivo JSON de Cucumber no contiene un array válido');
          return [];
        }
        
        const allResults: any[] = [];

        // Primero, recolectar todos los resultados (incluyendo duplicados por examples)
        for (const feature of jsonOutput) {
          for (const element of feature.elements || []) {
            if (element.type === 'scenario') {
              const scenarioResult = {
                scenarioName: element.name,
                scenarioTags: element.tags?.map((tag: any) => tag.name) || [],
                status: this.determineScenarioStatus(element.steps),
                // Cucumber reporta duration en nanosegundos; convertir a milisegundos
                duration: this.calculateScenarioDuration(element.steps),
                steps: this.parseScenarioSteps(element.steps),
                errorMessage: this.extractErrorMessage(element.steps),
                metadata: {
                  feature: feature.name,
                  tags: feature.tags?.map((tag: any) => tag.name) || [],
                  scenarioId: element.id,
                  line: element.line,
                },
              };

              allResults.push(scenarioResult);
            }
          }
        }

        // Mantener todas las ejecuciones individuales para scenarios con Examples
        // pero también crear estadísticas consolidadas
        const consolidatedResults = this.consolidateAndPreserveScenarios(allResults);

        this.logger.log(`Parseados ${allResults.length} escenarios totales, ${consolidatedResults.length} grupos de escenarios únicos del reporte JSON`);
        
        // Log detallado de escenarios fallidos
        const failedResults = consolidatedResults.filter(r => r.status === 'failed');
        if (failedResults.length > 0) {
          this.logger.error(`Se encontraron ${failedResults.length} escenarios fallidos:`);
          failedResults.forEach(result => {
            this.logger.error(`  - ${result.scenarioName}: ${result.errorMessage || 'Sin mensaje de error'}`);
          });
        }
        
        return consolidatedResults;
      } catch (fileError) {
        if (fileError.code === 'ENOENT') {
          this.logger.warn(`No se encontró el archivo JSON de Cucumber en: ${jsonReportPath}`);
        } else if (fileError instanceof SyntaxError) {
          this.logger.warn(`El archivo JSON de Cucumber está corrupto: ${fileError.message}`);
        } else {
          this.logger.warn(`No se pudo leer el archivo JSON de Cucumber: ${fileError.message}`);
        }
        
        // Si no se puede leer el archivo JSON, intentar parsear la salida stdout directamente
        this.logger.log('Intentando parsear la salida stdout directamente...');
        return [];
      }
    } catch (error) {
      this.logger.error(`Error parseando salida de Cucumber: ${error.message}`);
      return [];
    }
  }

  private determineScenarioStatus(steps: any[]): string {
    const failedSteps = steps.filter(step => step.result?.status === 'failed');
    const skippedSteps = steps.filter(step => step.result?.status === 'skipped');
    
    if (failedSteps.length > 0) return 'failed';
    if (skippedSteps.length === steps.length) return 'skipped';
    return 'passed';
  }

  private calculateScenarioDuration(steps: any[]): number {
    // Cucumber.js entrega duration en nanosegundos a nivel de step
    // Convertimos a milisegundos para nuestra API (consistente con executionTime)
    return steps.reduce((total, step) => {
      if (step.result?.duration) {
        return total + (step.result.duration / 1_000_000);
      }
      return total;
    }, 0);
  }

  private parseScenarioSteps(steps: any[]): any[] {
    return steps.map(step => {
      // Determinar el nombre del step
      let stepName = step.name;
      
      // Si no hay nombre explícito, usar el keyword para identificar el tipo de step
      if (!stepName || stepName.trim() === '') {
        if (step.keyword === 'Before') {
          stepName = 'Before Hook';
        } else if (step.keyword === 'After') {
          stepName = 'After Hook';
        } else if (step.keyword === 'BeforeStep') {
          stepName = 'Before Step Hook';
        } else if (step.keyword === 'AfterStep') {
          stepName = 'After Step Hook';
        } else {
          stepName = `${step.keyword} Step`;
        }
      }

      // Determinar si es un hook
      const isHook = ['Before', 'After', 'BeforeStep', 'AfterStep'].includes(step.keyword);
      
      return {
        stepName,
        status: step.result?.status || 'skipped',
        // Convertir de nanosegundos a milisegundos
        duration: step.result?.duration ? step.result.duration / 1_000_000 : 0,
        errorMessage: step.result?.error_message,
        timestamp: new Date(),
        isHook, // Identificar si es un hook
        hookType: isHook ? step.keyword : null, // Tipo de hook si aplica
      };
    });
  }

  private extractErrorMessage(steps: any[]): string | undefined {
    const failedSteps = steps.filter(step => step.result?.status === 'failed');
    
    if (failedSteps.length === 0) {
      return undefined;
    }
    
    // Si hay múltiples steps fallidos, combinar los mensajes
    const errorMessages = failedSteps.map(step => {
      const stepName = step.name || step.keyword || 'Unknown Step';
      const errorMessage = step.result?.error_message || 'Unknown error';
      return `${stepName}: ${errorMessage}`;
    });
    
    return errorMessages.join('; ');
  }

  private consolidateAndPreserveScenarios(allResults: any[]): any[] {
    const scenarioGroups = new Map<string, any[]>();

    // Agrupar escenarios por nombre
    for (const result of allResults) {
      const scenarioName = result.scenarioName;
      if (!scenarioGroups.has(scenarioName)) {
        scenarioGroups.set(scenarioName, []);
      }
      scenarioGroups.get(scenarioName)!.push(result);
    }

    // Procesar cada grupo de escenarios
    const processedResults: any[] = [];
    for (const [scenarioName, scenarios] of scenarioGroups) {
      if (scenarios.length === 1) {
        // Solo un escenario, usar directamente
        processedResults.push(scenarios[0]);
      } else {
        // Múltiples escenarios con el mismo nombre (por examples)
        // Crear un resultado consolidado PERO mantener las ejecuciones individuales
        const consolidatedScenario = this.consolidateScenarioGroup(scenarios);
        
        // Marcar que este escenario tiene múltiples ejecuciones
        consolidatedScenario.hasMultipleExecutions = true;
        consolidatedScenario.individualExecutions = scenarios.map((scenario, index) => ({
          ...scenario,
          executionIndex: index + 1,
          scenarioInstanceName: `${scenarioName} (Example ${index + 1})`,
        }));
        
        this.logger.log(`🔍 Escenario con Examples: ${scenarioName} - ${scenarios.length} ejecuciones`);
        scenarios.forEach((exec, idx) => {
          this.logger.log(`   Ejecución ${idx + 1}: Status=${exec.status}, Duration=${exec.duration}ms`);
        });
        
        processedResults.push(consolidatedScenario);
      }
    }

    return processedResults;
  }

  private deduplicateScenarios(allResults: any[]): any[] {
    const scenarioGroups = new Map<string, any[]>();

    // Agrupar escenarios por nombre
    for (const result of allResults) {
      const scenarioName = result.scenarioName;
      if (!scenarioGroups.has(scenarioName)) {
        scenarioGroups.set(scenarioName, []);
      }
      scenarioGroups.get(scenarioName)!.push(result);
    }

    // Consolidar cada grupo de escenarios
    const uniqueResults: any[] = [];
    for (const [scenarioName, scenarios] of scenarioGroups) {
      if (scenarios.length === 1) {
        // Solo un escenario, usar directamente
        uniqueResults.push(scenarios[0]);
      } else {
        // Múltiples escenarios con el mismo nombre (por examples), consolidar
        const consolidatedScenario = this.consolidateScenarioGroup(scenarios);
        uniqueResults.push(consolidatedScenario);
      }
    }

    return uniqueResults;
  }

  private consolidateScenarioGroup(scenarios: any[]): any {
    const firstScenario = scenarios[0];
    
    // Determinar el estado consolidado: si al menos uno falló, el escenario falló
    const hasAnyFailed = scenarios.some(s => s.status === 'failed');
    const consolidatedStatus = hasAnyFailed ? 'failed' : 'passed';
    
    // Sumar duraciones
    const totalDuration = scenarios.reduce((sum, s) => sum + s.duration, 0);
    
    // Consolidar mensajes de error
    const errorMessages = scenarios
      .filter(s => s.errorMessage)
      .map(s => s.errorMessage)
      .join('; ');
    
    // Consolidar steps (tomar los del primer escenario como representativo)
    const consolidatedSteps = firstScenario.steps;
    
    // Consolidar metadata
    const consolidatedMetadata = {
      ...firstScenario.metadata,
      totalExecutions: scenarios.length,
      executionDetails: scenarios.map(s => ({
        status: s.status,
        duration: s.duration,
        errorMessage: s.errorMessage,
        scenarioId: s.metadata.scenarioId,
        line: s.metadata.line,
      })),
    };

    return {
      scenarioName: firstScenario.scenarioName,
      scenarioTags: firstScenario.scenarioTags,
      status: consolidatedStatus,
      duration: totalDuration,
      steps: consolidatedSteps,
      errorMessage: errorMessages || undefined,
      metadata: consolidatedMetadata,
    };
  }
} 