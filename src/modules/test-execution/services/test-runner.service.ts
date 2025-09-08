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

  /**
   * Runs Playwright+Cucumber tests and parses results.
   *
   * Always attempts to parse the cucumber JSON report even if the command fails,
   * returning consolidated results and execution stats.
   *
   * @param projectPath - Absolute path to the Playwright project
   * @param dto - Execution configuration and filters
   */
  async runPlaywrightTests(projectPath: string, dto: ExecuteTestsDto) {
    this.logger.log(`Running Playwright tests for entity: ${dto.entityName}`);

    const startTime = Date.now();
    const results: any[] = [];

    try {
      // Ensure test-results directory exists
      const testResultsDir = path.join(projectPath, 'test-results');
      try {
        await fs.mkdir(testResultsDir, { recursive: true });
      } catch (error) {
        this.logger.warn(`Could not create test-results directory: ${error.message}`);
      }
      
      // Configure environment variables for execution
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
        // Configure workers for Playwright (not for Cucumber)
        WORKERS: dto.parallel && dto.workers ? dto.workers.toString() : '1',
        CI: 'false', // Ensure non-CI to allow workers
      };

      // Build execution command
      const command = this.buildExecutionCommand(dto);
      
      let testResults = '';
      let executionError: Error | null = null;
      
      try {
        // Execute tests
        testResults = await this.executePlaywrightCommand(projectPath, command, env);
      } catch (error) {
        executionError = error;
        this.logger.error(`Command failed: ${error.message}`);
        // Continue to parse JSON report anyway
      }
      
      // Always attempt to parse results, even if the command failed
      const parsedResults = await this.parseCucumberOutput(projectPath);
      
      // Calculate statistics
      const totalScenarios = parsedResults.length;
      const passedScenarios = parsedResults.filter(r => r.status === 'passed').length;
      const failedScenarios = parsedResults.filter(r => r.status === 'failed').length;

      // If no results parsed but command succeeded, assume passed
      if (totalScenarios === 0 && testResults && !executionError) {
        this.logger.log('Could not parse specific results, but execution was successful');
      }

      const executionTime = Date.now() - startTime;

      // If execution error occurred, throw after processing results
      if (executionError) {
        // Build a more detailed error from parsed info
        const errorMessage = parsedResults.length > 0 
          ? `Execution failed. ${failedScenarios} scenarios failed. Details: ${parsedResults.filter(r => r.status === 'failed').map(r => r.errorMessage).join('; ')}`
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
      this.logger.error(`Error running tests: ${error.message}`);
      throw error;
    }
  }

  /**
   * Builds the cucumber-js execution command based on the provided filters.
   */
  private buildExecutionCommand(dto: ExecuteTestsDto): string {
    let command = 'npx cucumber-js';

    // Use project base config
    command += ' src/features/**/*.feature';
    command += ' --require-module ts-node/register';
    command += ' --require src/steps/**/*.ts';
    command += ' --require src/steps/hooks.ts';

    // Filter by specific entity if provided
    if (dto.entityName) {
      command = `npx cucumber-js src/features/ecommerce/${dto.entityName.toLowerCase()}.feature`;
      command += ' --require-module ts-node/register';
      command += ' --require src/steps/**/*.ts';
      command += ' --require src/steps/hooks.ts';
    }

    // Filter by specific scenario (priority over tags)
    if (dto.specificScenario) {
      // If multiple comma-separated scenarios, add multiple --name filters
      const scenarios = dto.specificScenario.split(',').map(s => s.trim());
      if (scenarios.length === 1) {
        command += ` --name "${scenarios[0]}"`;
      } else {
        // For multiple scenarios, use multiple --name filters
        const nameFilters = scenarios.map(scenario => `--name "${scenario}"`).join(' ');
        command += ` ${nameFilters}`;
      }
    } else {
      // Only use tags if no specific scenarios
      if (dto.tags && dto.tags.length > 0) {
        const tagFilter = dto.tags.map(tag => `--tags "${tag}"`).join(' ');
        command += ` ${tagFilter}`;
      }
    }

    // Retries configuration (valid cucumber-js option)
    if (dto.retries && dto.retries > 0) {
      command += ` --retry ${dto.retries}`;
    }

    // Output format
    command += ' --format @cucumber/pretty-formatter';
    command += ' --format json:test-results/cucumber-report.json';

    // Parallelism configuration note (handled externally)
    if (dto.parallel && dto.workers && dto.workers > 1) {
      this.logger.log(`Configuring parallel execution with ${dto.workers} workers`);
    }

    // Timeout is handled via environment/config, not CLI

    this.logger.log(`Generated command: ${command}`);
    this.logger.log(`Applied filters:`);
    this.logger.log(`  - Specific scenarios: ${dto.specificScenario || 'none'}`);
    this.logger.log(`  - Tags: ${dto.tags?.join(', ') || 'none'}`);
    this.logger.log(`  - Entity: ${dto.entityName}`);
    return command;
  }

  /**
   * Executes the given shell command in the project path and returns stdout.
   */
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
        // Summarize logs: show only scenario name and pass/fail
        const lines = data.toString().split('\n');
        for (const line of lines) {
          // Detect scenario result lines
          if (/^✅\s+Scenario:/.test(line)) {
            // Scenario passed
            const match = line.match(/^✅\s+Scenario: (.+)$/);
            if (match) {
              this.logger.log(`✅ PASSED: ${match[1]}`);
            }
          } else if (/^❌\s+Scenario:/.test(line)) {
            // Scenario failed
            const match = line.match(/^❌\s+Scenario: (.+)$/);
            if (match) {
              this.logger.error(`❌ FAILED: ${match[1]}`);
            }
          } else if (/^Scenario:/.test(line)) {
            // Scenario line without symbol: log as info
            const match = line.match(/^Scenario: (.+)$/);
            if (match) {
              this.logger.log(`Scenario: ${match[1]}`);
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
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Error executing command: ${error.message}`));
      });
    });
  }

  /**
   * Parses the cucumber JSON report and returns consolidated scenario results.
   */
  public async parseCucumberOutput(projectPath: string): Promise<any[]> {
    try {
      // Read the JSON output generated by Cucumber
      const jsonReportPath = path.join(projectPath, 'test-results', 'cucumber-report.json');
      
      try {
        // Ensure file exists
        await fs.access(jsonReportPath);
        
        const jsonContent = await fs.readFile(jsonReportPath, 'utf8');
        
        if (!jsonContent.trim()) {
          this.logger.warn('Cucumber JSON report is empty');
          return [];
        }
        
        const jsonOutput = JSON.parse(jsonContent);
        
        if (!Array.isArray(jsonOutput)) {
          this.logger.warn('Cucumber JSON report does not contain a valid array');
          return [];
        }
        
        const allResults: any[] = [];

        // First, collect all results (including duplicates for examples)
        for (const feature of jsonOutput) {
          for (const element of feature.elements || []) {
            if (element.type === 'scenario') {
              const scenarioResult = {
                scenarioName: element.name,
                scenarioTags: element.tags?.map((tag: any) => tag.name) || [],
                status: this.determineScenarioStatus(element.steps),
                // Cucumber reports duration in ns; convert to ms
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

        // Keep all individual executions for scenarios with Examples
        // but also create consolidated statistics
        const consolidatedResults = this.consolidateAndPreserveScenarios(allResults);

        this.logger.log(`Parsed ${allResults.length} total scenarios, ${consolidatedResults.length} unique scenario groups from JSON report`);
        
        // Detailed log for failed scenarios
        const failedResults = consolidatedResults.filter(r => r.status === 'failed');
        if (failedResults.length > 0) {
          this.logger.error(`Found ${failedResults.length} failed scenarios:`);
          failedResults.forEach(result => {
            this.logger.error(`  - ${result.scenarioName}: ${result.errorMessage || 'No error message'}`);
          });
        }
        
        return consolidatedResults;
      } catch (fileError) {
        if (fileError.code === 'ENOENT') {
          this.logger.warn(`Cucumber JSON report not found at: ${jsonReportPath}`);
        } else if (fileError instanceof SyntaxError) {
          this.logger.warn(`Cucumber JSON report is corrupted: ${fileError.message}`);
        } else {
          this.logger.warn(`Could not read Cucumber JSON report: ${fileError.message}`);
        }
        
        // If JSON report not available, attempt to parse stdout (not implemented here)
        this.logger.log('Attempting to parse stdout directly...');
        return [];
      }
    } catch (error) {
      this.logger.error(`Error parsing Cucumber output: ${error.message}`);
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
    // Cucumber.js provides duration in ns at step level. Convert to ms for API consistency.
    return steps.reduce((total, step) => {
      if (step.result?.duration) {
        return total + (step.result.duration / 1_000_000);
      }
      return total;
    }, 0);
  }

  private parseScenarioSteps(steps: any[]): any[] {
    return steps.map(step => {
      // Determine step name
      let stepName = step.name;
      
      // If no explicit name, use the keyword to identify the step type
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

      // Determine if it is a hook
      const isHook = ['Before', 'After', 'BeforeStep', 'AfterStep'].includes(step.keyword);
      
      return {
        stepName,
        status: step.result?.status || 'skipped',
        // Convert ns to ms
        duration: step.result?.duration ? step.result.duration / 1_000_000 : 0,
        errorMessage: step.result?.error_message,
        timestamp: new Date(),
        isHook, // Identify if it is a hook
        hookType: isHook ? step.keyword : null, // Hook type if applies
      };
    });
  }

  private extractErrorMessage(steps: any[]): string | undefined {
    const failedSteps = steps.filter(step => step.result?.status === 'failed');
    
    if (failedSteps.length === 0) {
      return undefined;
    }
    
    // If multiple failed steps, merge messages
    const errorMessages = failedSteps.map(step => {
      const stepName = step.name || step.keyword || 'Unknown Step';
      const errorMessage = step.result?.error_message || 'Unknown error';
      return `${stepName}: ${errorMessage}`;
    });
    
    return errorMessages.join('; ');
  }

  private consolidateAndPreserveScenarios(allResults: any[]): any[] {
    const scenarioGroups = new Map<string, any[]>();

    // Group scenarios by name
    for (const result of allResults) {
      const scenarioName = result.scenarioName;
      if (!scenarioGroups.has(scenarioName)) {
        scenarioGroups.set(scenarioName, []);
      }
      scenarioGroups.get(scenarioName)!.push(result);
    }

    // Process each scenario group
    const processedResults: any[] = [];
    for (const [scenarioName, scenarios] of scenarioGroups) {
      if (scenarios.length === 1) {
        // Only one scenario, use directly
        processedResults.push(scenarios[0]);
      } else {
        // Multiple scenarios (Examples). Create a consolidated result BUT keep individual runs
        const consolidatedScenario = this.consolidateScenarioGroup(scenarios);
        
        // Mark this scenario as having multiple executions
        consolidatedScenario.hasMultipleExecutions = true;
        consolidatedScenario.individualExecutions = scenarios.map((scenario, index) => ({
          ...scenario,
          executionIndex: index + 1,
          scenarioInstanceName: `${scenarioName} (Example ${index + 1})`,
        }));
        
        this.logger.log(`🔍 Scenario with Examples: ${scenarioName} - ${scenarios.length} executions`);
        scenarios.forEach((exec, idx) => {
          this.logger.log(`   Execution ${idx + 1}: Status=${exec.status}, Duration=${exec.duration}ms`);
        });
        
        processedResults.push(consolidatedScenario);
      }
    }

    return processedResults;
  }

  private deduplicateScenarios(allResults: any[]): any[] {
    const scenarioGroups = new Map<string, any[]>();

    // Group scenarios by name
    for (const result of allResults) {
      const scenarioName = result.scenarioName;
      if (!scenarioGroups.has(scenarioName)) {
        scenarioGroups.set(scenarioName, []);
      }
      scenarioGroups.get(scenarioName)!.push(result);
    }

    // Consolidate each scenario group
    const uniqueResults: any[] = [];
    for (const [scenarioName, scenarios] of scenarioGroups) {
      if (scenarios.length === 1) {
        // Only one scenario, use directly
        uniqueResults.push(scenarios[0]);
      } else {
        // Multiple scenarios with same name (Examples), consolidate
        const consolidatedScenario = this.consolidateScenarioGroup(scenarios);
        uniqueResults.push(consolidatedScenario);
      }
    }

    return uniqueResults;
  }

  private consolidateScenarioGroup(scenarios: any[]): any {
    const firstScenario = scenarios[0];
    
    // Determine consolidated status: if any failed, the scenario failed
    const hasAnyFailed = scenarios.some(s => s.status === 'failed');
    const consolidatedStatus = hasAnyFailed ? 'failed' : 'passed';
    
    // Sum durations
    const totalDuration = scenarios.reduce((sum, s) => sum + s.duration, 0);
    
    // Consolidate error messages
    const errorMessages = scenarios
      .filter(s => s.errorMessage)
      .map(s => s.errorMessage)
      .join('; ');
    
    // Consolidate steps (take the first scenario as representative)
    const consolidatedSteps = firstScenario.steps;
    
    // Consolidate metadata
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