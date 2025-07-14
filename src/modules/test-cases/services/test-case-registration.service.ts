import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestCase, TestCaseStatus, TestType } from '../entities/test-case.entity';
import { Project } from '../../projects/project.entity';
import { RegisterEndpointDto } from '../../endpoints/dto/register-endpoint.dto';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class TestCaseRegistrationService {
  private readonly logger = new Logger(TestCaseRegistrationService.name);

  constructor(
    @InjectRepository(TestCase)
    private readonly testCaseRepository: Repository<TestCase>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  async getNextTestCaseNumber(projectId: string, section: string): Promise<number> {
    const pattern = `TC-${section}-`;
    const testCases = await this.testCaseRepository
      .createQueryBuilder('testCase')
      .where('testCase.projectId = :projectId', { projectId })
      .andWhere('testCase.testCaseId LIKE :pattern', { pattern: `${pattern}%` })
      .getMany();
    let maxNumber = 0;
    for (const tc of testCases) {
      const match = tc.testCaseId.match(new RegExp(`${pattern}(\\d+)`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) maxNumber = num;
      }
    }
    return maxNumber + 1;
  }

  async processFeatureFileAndRegisterTestCases(
    projectId: string,
    section: string,
    entityName: string,
    dto: RegisterEndpointDto,
  ): Promise<void> {
    try {
      const project = await this.projectRepository.findOne({ where: { id: projectId } });
      if (!project) throw new Error(`Project with ID ${projectId} not found`);
      const featureFilePath = path.join(
        project.path,
        'src',
        'features',
        section,
        `${entityName.toLowerCase()}.feature`
      );
      let featureContent = await fs.readFile(featureFilePath, 'utf-8');
      const lines = featureContent.split('\n');
      const tagPattern = `@TC-${section}-Number`;
      let currentNumber = await this.getNextTestCaseNumber(projectId, section);
      let replacements: { lineIdx: number, scenarioName: string, number: number, tags: string[], steps: string }[] = [];

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(tagPattern)) {
          // Extraer todos los tags del escenario
          const tags = this.extractTagsForScenario(lines, i);
          
          let scenarioName = '';
          let steps = '';
          let found = false;
          
          // Buscar el nombre del escenario
          for (let j = i + 1; j < lines.length; j++) {
            const nextLine = lines[j].trim();
            if (nextLine.startsWith('Scenario:') || nextLine.startsWith('Scenario Outline:')) {
              scenarioName = nextLine.replace('Scenario:', '').replace('Scenario Outline:', '').trim();
              found = true;
              
              // Extraer los steps desde la siguiente línea hasta el próximo escenario o final del archivo
              steps = this.extractStepsFromScenario(lines, j + 1);
              break;
            }
            if (nextLine.startsWith('@') || nextLine === '') continue;
          }
          
          // Si no se encontró, intentar buscar hacia atrás (por si es el último del archivo)
          if (!found && i < lines.length - 1) {
            for (let j = i + 1; j < lines.length; j++) {
              if (lines[j].trim() !== '' && !lines[j].trim().startsWith('@')) {
                scenarioName = lines[j].trim();
                steps = this.extractStepsFromScenario(lines, j + 1);
                found = true;
                break;
              }
            }
          }
          
          if (!found) {
            this.logger.warn(`[REGISTRO] No se encontró el nombre del escenario después del tag en línea ${i + 1}`);
          }
          
          if (scenarioName) {
//             this.logger.log(`Encontrado tag en línea ${i + 1}`);
//             this.logger.log(`Escenario: "${scenarioName}"`);
//             this.logger.log(`Tags encontrados: ${tags.join(', ')}`);
//             this.logger.log(`Steps extraídos: ${steps.split('\n').length} líneas`);
//             this.logger.log(`Asignando número: ${currentNumber}`);
            
            lines[i] = lines[i].replace(tagPattern, `@TC-${section}-${currentNumber}`);
            replacements.push({ 
              lineIdx: i, 
              scenarioName, 
              number: currentNumber, 
              tags, 
              steps 
            });
            currentNumber++;
          }
        }
      }
      
      await fs.writeFile(featureFilePath, lines.join('\n'), 'utf-8');
//     this.logger.log(`Feature file actualizado con tags reemplazados: ${featureFilePath}`);

      for (const rep of replacements) {
        const method = this.determineMethodFromScenario(rep.scenarioName, dto.methods);
//         this.logger.log(`Creando test case: TC-${section}-${rep.number} - ${rep.scenarioName} - Método: ${method}`);
        await this.createTestCaseFromScenario(
          projectId,
          section,
          entityName,
          rep.scenarioName,
          method,
          rep.number,
          rep.tags,
          rep.steps
        );
      }
//     this.logger.log(`Total de test cases registrados: ${replacements.length}`);
    } catch (error) {
      this.logger.error(`Error procesando feature file:`, error);
      throw error;
    }
  }

  private extractTagsForScenario(lines: string[], tagLineIndex: number): string[] {
    const tags: string[] = [];
    
    // Buscar tags hacia arriba desde la línea del tag TC
    for (let i = tagLineIndex; i >= 0; i--) {
      const line = lines[i].trim();
      if (line === '') break; // Línea vacía marca el fin de los tags
      if (line.startsWith('@')) {
        // Omitir tags de numeración
        if (!line.match(/^@TC-/)) {
          tags.unshift(line);
        }
      } else if (!line.startsWith('Feature:') && !line.startsWith('Background:')) {
        break; // Si no es tag ni feature ni background, terminar
      }
    }
    
    return tags;
  }

  private extractStepsFromScenario(lines: string[], startLineIndex: number): string {
    const steps: string[] = [];
    
    for (let i = startLineIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Si encontramos otro escenario, outline, o línea vacía seguida de tag, terminar
      if (line.startsWith('Scenario:') || line.startsWith('Scenario Outline:')) {
        break;
      }
      
      // Si encontramos una línea vacía seguida de un tag, también terminar
      if (line === '' && i + 1 < lines.length && lines[i + 1].trim().startsWith('@')) {
        break;
      }
      
      // Si la línea no está vacía y no es un tag, es un step
      if (line !== '' && !line.startsWith('@')) {
        steps.push(line);
      }
    }
    
    return steps.join('\n');
  }

  private determineMethodFromScenario(scenarioName: string, methods: any[]): string {
    const scenarioLower = scenarioName.toLowerCase();
    if (scenarioLower.includes('create') || scenarioLower.includes('post')) return 'POST';
    if (scenarioLower.includes('get') || scenarioLower.includes('read')) return 'GET';
    if (scenarioLower.includes('update') || scenarioLower.includes('patch')) return 'PATCH';
    if (scenarioLower.includes('replace') || scenarioLower.includes('put')) return 'PUT';
    if (scenarioLower.includes('delete') || scenarioLower.includes('remove')) return 'DELETE';
    return methods[0]?.method || 'GET';
  }

  private async createTestCaseFromScenario(
    projectId: string,
    section: string,
    entityName: string,
    scenarioName: string,
    method: string,
    number: number,
    tags: string[],
    steps: string,
  ): Promise<void> {
    const testCaseId = `TC-${section}-${number}`;
    const testType = this.determineTestType(scenarioName);
    
    this.logger.log(`Guardando en BD: ${testCaseId} - ${scenarioName} - tags: ${tags.join(', ')} - tipo: ${testType}`);
//     this.logger.log(`Steps a guardar: ${steps.split('\n').length} líneas`);
    
    const testCase = this.testCaseRepository.create({
      testCaseId,
      projectId,
      entityName,
      section,
      name: scenarioName,
      description: `Automatically generated test case for ${entityName} ${method} operation`,
      tags,
      method,
      testType,
      scenario: steps, // Guardar los steps como texto
      status: TestCaseStatus.ACTIVE,
    });
    await this.testCaseRepository.save(testCase);
  }

  private determineTestType(scenarioName: string): TestType {
    const scenarioLower = scenarioName.toLowerCase();
    if (scenarioLower.includes('invalid') || scenarioLower.includes('missing') || scenarioLower.includes('error')) {
      return TestType.NEGATIVE;
    }
    if (scenarioLower.includes('regression')) {
      return TestType.POSITIVE;
    }
    return TestType.POSITIVE;
  }
} 