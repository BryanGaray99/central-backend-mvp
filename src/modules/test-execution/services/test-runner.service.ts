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
        TEST_WORKERS: dto.workers?.toString(),
      };

      // Construir comando de ejecución
      const command = this.buildExecutionCommand(dto);
      
      // Ejecutar pruebas
      const testResults = await this.executePlaywrightCommand(projectPath, command, env);
      
      // Parsear resultados
      const parsedResults = await this.parseCucumberOutput(projectPath);
      
      // Calcular estadísticas
      const totalScenarios = parsedResults.length;
      const passedScenarios = parsedResults.filter(r => r.status === 'passed').length;
      const failedScenarios = parsedResults.filter(r => r.status === 'failed').length;

      const executionTime = Date.now() - startTime;

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

    // Filtrar por tags
    if (dto.tags && dto.tags.length > 0) {
      const tagFilter = dto.tags.map(tag => `--tags "${tag}"`).join(' ');
      command += ` ${tagFilter}`;
    }

    // Filtrar por escenario específico
    if (dto.specificScenario) {
      command += ` --name "${dto.specificScenario}"`;
    }

    // Configuración de retries (opción válida en Cucumber.js)
    if (dto.retries && dto.retries > 0) {
      command += ` --retry ${dto.retries}`;
    }

    // Formato de salida
    command += ' --format @cucumber/pretty-formatter';
    command += ' --format json:test-results/cucumber-report.json';

    // Configuración de paralelismo (usar --parallel-workers en lugar de --parallel)
    if (dto.parallel && dto.workers && dto.workers > 1) {
      command += ` --parallel-workers ${dto.workers}`;
    }

    // Timeout se maneja a través de variables de entorno o configuración de Playwright
    // No se pasa como parámetro de línea de comandos a Cucumber

    this.logger.log(`Comando generado: ${command}`);
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

  private async parseCucumberOutput(projectPath: string): Promise<any[]> {
    try {
      // Leer el archivo JSON generado por Cucumber
      const jsonReportPath = path.join(projectPath, 'test-results', 'cucumber-report.json');
      
      try {
        const jsonContent = await fs.readFile(jsonReportPath, 'utf8');
        const jsonOutput = JSON.parse(jsonContent);
        const results: any[] = [];

        for (const feature of jsonOutput) {
          for (const element of feature.elements || []) {
            if (element.type === 'scenario') {
              const scenarioResult = {
                scenarioName: element.name,
                scenarioTags: element.tags?.map((tag: any) => tag.name) || [],
                status: this.determineScenarioStatus(element.steps),
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

              results.push(scenarioResult);
            }
          }
        }

        this.logger.log(`Parseados ${results.length} escenarios del reporte JSON`);
        return results;
      } catch (fileError) {
        this.logger.warn(`No se pudo leer el archivo JSON de Cucumber: ${fileError.message}`);
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
    return steps.reduce((total, step) => {
      if (step.result?.duration) {
        return total + step.result.duration;
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
        duration: step.result?.duration || 0,
        errorMessage: step.result?.error_message,
        timestamp: new Date(),
        isHook, // Identificar si es un hook
        hookType: isHook ? step.keyword : null, // Tipo de hook si aplica
      };
    });
  }

  private extractErrorMessage(steps: any[]): string | undefined {
    const failedStep = steps.find(step => step.result?.status === 'failed');
    return failedStep?.result?.error_message;
  }
} 