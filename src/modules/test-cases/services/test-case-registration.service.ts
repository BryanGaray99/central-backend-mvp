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
      let replacements: { lineIdx: number, scenarioName: string, number: number }[] = [];

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(tagPattern)) {
          let scenarioName = '';
          let found = false;
          for (let j = i + 1; j < lines.length; j++) {
            const nextLine = lines[j].trim();
            if (nextLine.startsWith('Scenario:') || nextLine.startsWith('Scenario Outline:')) {
              scenarioName = nextLine.replace('Scenario:', '').replace('Scenario Outline:', '').trim();
              found = true;
              break;
            }
            if (nextLine.startsWith('@') || nextLine === '') continue;
          }
          // Si no se encontró, intentar buscar hacia atrás (por si es el último del archivo)
          if (!found && i < lines.length - 1) {
            for (let j = i + 1; j < lines.length; j++) {
              if (lines[j].trim() !== '' && !lines[j].trim().startsWith('@')) {
                scenarioName = lines[j].trim();
                found = true;
                break;
              }
            }
          }
          if (!found) {
            this.logger.warn(`[REGISTRO] No se encontró el nombre del escenario después del tag en línea ${i + 1}`);
          }
          if (scenarioName) {
            this.logger.log(`[REGISTRO] Encontrado tag en línea ${i + 1}`);
            this.logger.log(`[REGISTRO] Escenario: "${scenarioName}"`);
            this.logger.log(`[REGISTRO] Asignando número: ${currentNumber}`);
            lines[i] = lines[i].replace(tagPattern, `@TC-${section}-${currentNumber}`);
            replacements.push({ lineIdx: i, scenarioName, number: currentNumber });
            currentNumber++;
          }
        }
      }
      await fs.writeFile(featureFilePath, lines.join('\n'), 'utf-8');
      this.logger.log(`[REGISTRO] Feature file actualizado con tags reemplazados: ${featureFilePath}`);

      for (const rep of replacements) {
        const method = this.determineMethodFromScenario(rep.scenarioName, dto.methods);
        this.logger.log(`[REGISTRO] Creando test case: TC-${section}-${rep.number} - ${rep.scenarioName} - Método: ${method}`);
        await this.createTestCaseFromScenario(
          projectId,
          section,
          entityName,
          rep.scenarioName,
          method,
          rep.number
        );
      }
      this.logger.log(`[REGISTRO] Total de test cases registrados: ${replacements.length}`);
    } catch (error) {
      this.logger.error(`[REGISTRO] Error procesando feature file:`, error);
      throw error;
    }
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
  ): Promise<void> {
    const testCaseId = `TC-${section}-${number}`;
    const tags = this.generateTagsForMethod(method);
    const testType = this.determineTestType(scenarioName);
    const scenario = this.createBasicScenarioStructure(method, entityName);
    this.logger.log(`[REGISTRO] Guardando en BD: ${testCaseId} - ${scenarioName} - tags: ${tags.join(', ')} - tipo: ${testType}`);
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
      scenario,
      status: TestCaseStatus.ACTIVE,
    });
    await this.testCaseRepository.save(testCase);
  }

  private generateTagsForMethod(method: string): string[] {
    const tags = ['@smoke'];
    switch (method) {
      case 'POST': tags.push('@create'); break;
      case 'GET': tags.push('@read'); break;
      case 'PUT':
      case 'PATCH': tags.push('@update'); break;
      case 'DELETE': tags.push('@delete'); break;
    }
    return tags;
  }

  private determineTestType(scenarioName: string): TestType {
    const scenarioLower = scenarioName.toLowerCase();
    if (scenarioLower.includes('invalid') || scenarioLower.includes('missing') || scenarioLower.includes('error')) {
      return TestType.NEGATIVE;
    }
    if (scenarioLower.includes('regression')) {
      // No existe TestType.EDGE, usar POSITIVE para regresión
      return TestType.POSITIVE;
    }
    return TestType.POSITIVE;
  }

  private createBasicScenarioStructure(method: string, entityName: string): any {
    const entityLower = entityName.toLowerCase();
    switch (method) {
      case 'POST':
        return { given: [{ stepId: `ST-${entityLower}-setup`, order: 1 }], when: [{ stepId: `ST-${entityLower}-create`, order: 1 }], then: [{ stepId: `ST-${entityLower}-validate`, order: 1 }] };
      case 'GET':
        return { given: [{ stepId: `ST-${entityLower}-setup`, order: 1 }], when: [{ stepId: `ST-${entityLower}-get`, order: 1 }], then: [{ stepId: `ST-${entityLower}-validate`, order: 1 }] };
      case 'PUT':
      case 'PATCH':
        return { given: [{ stepId: `ST-${entityLower}-setup`, order: 1 }], when: [{ stepId: `ST-${entityLower}-update`, order: 1 }], then: [{ stepId: `ST-${entityLower}-validate`, order: 1 }] };
      case 'DELETE':
        return { given: [{ stepId: `ST-${entityLower}-setup`, order: 1 }], when: [{ stepId: `ST-${entityLower}-delete`, order: 1 }], then: [{ stepId: `ST-${entityLower}-validate`, order: 1 }] };
      default:
        return { given: [], when: [], then: [] };
    }
  }
} 