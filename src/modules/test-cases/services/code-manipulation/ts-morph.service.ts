import { Injectable, Logger } from '@nestjs/common';
import { Project, SourceFile, ClassDeclaration, InterfaceDeclaration, MethodDeclaration, ScriptTarget, ModuleKind } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';
import { 
  CodeAnalysis, 
  TestModifications, 
  CodePattern 
} from '../../interfaces/ts-morph.interface';

@Injectable()
export class TSMorphService {
  private readonly logger = new Logger(TSMorphService.name);
  private project: Project | null = null;
  private readonly ANALYSIS_FILENAME = 'project-analysis.json';

  constructor() {}

  /**
   * Inicializa el proyecto TS-Morph
   */
  async initializeProject(projectPath: string): Promise<void> {
    try {
      this.project = new Project({
        tsConfigFilePath: path.join(projectPath, 'tsconfig.json'),
        skipAddingFilesFromTsConfig: false,
      });

      this.logger.log(`Proyecto TS-Morph inicializado en: ${projectPath}`);
    } catch (error) {
      this.logger.warn('No se encontró tsconfig.json, usando configuración por defecto');
      this.project = new Project({
        compilerOptions: {
          target: ScriptTarget.ES2020,
          module: ModuleKind.CommonJS,
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
        },
      });
    }
  }

  /**
   * Analiza el proyecto completo
   */
  async analyzeProject(projectPath: string): Promise<CodeAnalysis> {
    const startTime = Date.now();
    
    try {
      // Primero intentar cargar análisis existente
      const existingAnalysis = await this.loadAnalysisFromFile(projectPath);
      if (existingAnalysis) {
        this.logger.log('Análisis cargado desde archivo existente');
        return existingAnalysis;
      }

      // Si no existe, realizar análisis completo
      await this.initializeProject(projectPath);

      if (!this.project) {
        throw new Error('Proyecto TS-Morph no inicializado');
      }

      const sourceFiles = this.project.getSourceFiles();
      
      this.logger.log(`Analizando ${sourceFiles.length} archivos fuente`);
      
      const analysis: CodeAnalysis = {
        existingTests: this.findExistingTests(sourceFiles),
        imports: this.analyzeImports(sourceFiles),
        patterns: this.extractPatterns(sourceFiles),
        classes: this.analyzeClasses(sourceFiles),
        interfaces: this.analyzeInterfaces(sourceFiles),
        methods: this.analyzeMethods(sourceFiles),
      };

      // Guardar análisis en archivo
      await this.saveAnalysisToFile(projectPath, analysis);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      this.logger.log(`Análisis completado en ${processingTime}ms`);
      return analysis;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Encuentra tests existentes en el proyecto
   */
  private findExistingTests(sourceFiles: SourceFile[]): any[] {
    const tests: any[] = [];

    sourceFiles.forEach(sourceFile => {
      const filePath = sourceFile.getFilePath();
      
      // Buscar archivos de test
      if (filePath.includes('.spec.') || filePath.includes('.test.') || filePath.includes('steps/')) {
        const classes = sourceFile.getClasses();
        const functions = sourceFile.getFunctions();
        
        classes.forEach(cls => {
          tests.push({
            type: 'class',
            name: cls.getName(),
            filePath,
            methods: cls.getMethods().map(method => method.getName()),
          });
        });

        functions.forEach(func => {
          tests.push({
            type: 'function',
            name: func.getName(),
            filePath,
          });
        });
      }
    });

    return tests;
  }

  /**
   * Analiza imports del proyecto
   */
  private analyzeImports(sourceFiles: SourceFile[]): string[] {
    const imports: string[] = [];

    sourceFiles.forEach(sourceFile => {
      const importDeclarations = sourceFile.getImportDeclarations();
      
      importDeclarations.forEach(importDecl => {
        const moduleSpecifier = importDecl.getModuleSpecifierValue();
        if (moduleSpecifier && !imports.includes(moduleSpecifier)) {
          imports.push(moduleSpecifier);
        }
      });
    });

    return imports;
  }

  /**
   * Extrae patrones de código
   */
  private extractPatterns(sourceFiles: SourceFile[]): any[] {
    const patterns: any[] = [];

    sourceFiles.forEach(sourceFile => {
      // Patrones de testing
      const testPatterns = this.extractTestPatterns(sourceFile);
      patterns.push(...testPatterns);

      // Patrones de estructura
      const structurePatterns = this.extractStructurePatterns(sourceFile);
      patterns.push(...structurePatterns);
    });

    return patterns;
  }

  /**
   * Extrae patrones específicos de testing
   */
  private extractTestPatterns(sourceFile: SourceFile): any[] {
    const patterns: any[] = [];
    const text = sourceFile.getFullText();

    // Patrones de Playwright
    if (text.includes('test(') || text.includes('expect(')) {
      patterns.push({
        type: 'playwright-test',
        filePath: sourceFile.getFilePath(),
        pattern: 'playwright-testing',
      });
    }

    // Patrones de Cucumber
    if (text.includes('Given(') || text.includes('When(') || text.includes('Then(')) {
      patterns.push({
        type: 'cucumber-steps',
        filePath: sourceFile.getFilePath(),
        pattern: 'cucumber-bdd',
      });
    }

    // Patrones de fixtures
    if (text.includes('fixture') || text.includes('Fixture')) {
      patterns.push({
        type: 'test-fixtures',
        filePath: sourceFile.getFilePath(),
        pattern: 'test-data',
      });
    }

    return patterns;
  }

  /**
   * Extrae patrones de estructura
   */
  private extractStructurePatterns(sourceFile: SourceFile): any[] {
    const patterns: any[] = [];
    const text = sourceFile.getFullText();

    // Patrones de API clients
    if (text.includes('BaseApiClient') || text.includes('ApiClient')) {
      patterns.push({
        type: 'api-client',
        filePath: sourceFile.getFilePath(),
        pattern: 'api-testing',
      });
    }

    // Patrones de validación
    if (text.includes('schema') || text.includes('Schema')) {
      patterns.push({
        type: 'validation-schema',
        filePath: sourceFile.getFilePath(),
        pattern: 'data-validation',
      });
    }

    return patterns;
  }

  /**
   * Analiza clases del proyecto
   */
  private analyzeClasses(sourceFiles: SourceFile[]): any[] {
    const classes: any[] = [];

    sourceFiles.forEach(sourceFile => {
      const classDeclarations = sourceFile.getClasses();
      
      classDeclarations.forEach(cls => {
        classes.push({
          name: cls.getName(),
          filePath: sourceFile.getFilePath(),
          methods: cls.getMethods().map(method => ({
            name: method.getName(),
            parameters: method.getParameters().map(param => ({
              name: param.getName(),
              type: param.getType().getText(),
            })),
            returnType: method.getReturnType().getText(),
          })),
          properties: cls.getProperties().map(prop => ({
            name: prop.getName(),
            type: prop.getType().getText(),
          })),
        });
      });
    });

    return classes;
  }

  /**
   * Analiza interfaces del proyecto
   */
  private analyzeInterfaces(sourceFiles: SourceFile[]): any[] {
    const interfaces: any[] = [];

    sourceFiles.forEach(sourceFile => {
      const interfaceDeclarations = sourceFile.getInterfaces();
      
      interfaceDeclarations.forEach(intf => {
        interfaces.push({
          name: intf.getName(),
          filePath: sourceFile.getFilePath(),
          properties: intf.getProperties().map(prop => ({
            name: prop.getName(),
            type: prop.getType().getText(),
          })),
        });
      });
    });

    return interfaces;
  }

  /**
   * Analiza métodos del proyecto
   */
  private analyzeMethods(sourceFiles: SourceFile[]): any[] {
    const methods: any[] = [];

    sourceFiles.forEach(sourceFile => {
      const functions = sourceFile.getFunctions();
      
      functions.forEach(func => {
        methods.push({
          name: func.getName(),
          filePath: sourceFile.getFilePath(),
          parameters: func.getParameters().map(param => ({
            name: param.getName(),
            type: param.getType().getText(),
          })),
          returnType: func.getReturnType().getText(),
        });
      });
    });

    return methods;
  }

  /**
   * Valida y refina código generado
   */
  async validateAndRefine(generatedCode: string, analysis: CodeAnalysis): Promise<string> {
    try {
      // Crear archivo temporal para validación
      const tempFile = this.project?.createSourceFile('temp-validation.ts', generatedCode);
      
      if (!tempFile) {
        throw new Error('No se pudo crear archivo temporal para validación');
      }

      // Obtener diagnósticos
      const diagnostics = tempFile.getPreEmitDiagnostics();
      
      if (diagnostics.length > 0) {
        this.logger.warn('Se encontraron errores en el código generado:', diagnostics.length);
        
        // Intentar corregir errores básicos
        return this.fixCommonErrors(generatedCode, diagnostics);
      }

      // Aplicar patrones del proyecto
      return this.applyProjectPatterns(generatedCode, analysis);
      
    } catch (error) {
      this.logger.error('Error en validación TS-Morph:', error.message);
      return generatedCode; // Retornar código original si falla la validación
    }
  }

  /**
   * Corrige errores comunes en el código
   */
  private fixCommonErrors(code: string, diagnostics: any[]): string {
    let fixedCode = code;

    diagnostics.forEach(diagnostic => {
      const message = diagnostic.getMessageText();
      
      // Corregir imports faltantes
      if (message.includes('Cannot find module')) {
        const moduleName = this.extractModuleName(message);
        if (moduleName) {
          const importStatement = `import { ${moduleName} } from '${moduleName}';\n`;
          fixedCode = importStatement + fixedCode;
        }
      }

      // Corregir tipos faltantes
      if (message.includes('implicitly has an \'any\' type')) {
        fixedCode = fixedCode.replace(/const (\w+)/g, 'const $1: any');
      }
    });

    return fixedCode;
  }

  /**
   * Extrae nombre del módulo de mensaje de error
   */
  private extractModuleName(message: string): string | null {
    const match = message.match(/Cannot find module '([^']+)'/);
    return match ? match[1] : null;
  }

  /**
   * Aplica patrones del proyecto al código generado
   */
  private applyProjectPatterns(code: string, analysis: CodeAnalysis): string {
    let refinedCode = code;

    // Aplicar imports comunes del proyecto
    const commonImports = this.getCommonImports(analysis);
    if (commonImports.length > 0) {
      const importStatements = commonImports.map(imp => `import { ${imp} } from '${imp}';`).join('\n');
      refinedCode = importStatements + '\n\n' + refinedCode;
    }

    // Aplicar patrones de testing encontrados
    const testPatterns = analysis.patterns.filter(p => p.type.includes('test'));
    if (testPatterns.length > 0) {
      refinedCode = this.applyTestPatterns(refinedCode, testPatterns);
    }

    return refinedCode;
  }

  /**
   * Obtiene imports comunes del proyecto
   */
  private getCommonImports(analysis: CodeAnalysis): string[] {
    const commonImports = [
      'test', 'expect', 'Given', 'When', 'Then', 'Before', 'After'
    ];

    return commonImports.filter(imp => 
      analysis.imports.some(projectImport => 
        projectImport.includes(imp.toLowerCase())
      )
    );
  }

  /**
   * Aplica patrones de testing al código
   */
  private applyTestPatterns(code: string, patterns: any[]): string {
    let refinedCode = code;

    patterns.forEach(pattern => {
      if (pattern.type === 'playwright-test') {
        // Asegurar que use sintaxis de Playwright
        refinedCode = refinedCode.replace(/describe\(/g, 'test(');
      }
      
      if (pattern.type === 'cucumber-steps') {
        // Asegurar que use sintaxis de Cucumber
        refinedCode = refinedCode.replace(/test\(/g, 'Given(');
      }
    });

    return refinedCode;
  }

  /**
   * Modifica un archivo de test existente
   */
  async modifyTestFile(filePath: string, modifications: TestModifications): Promise<string> {
    try {
      const sourceFile = this.project?.getSourceFile(filePath);
      
      if (!sourceFile) {
        throw new Error(`Archivo no encontrado: ${filePath}`);
      }

      // Aplicar modificaciones
      modifications.newTests.forEach(test => {
        if (test.type === 'class') {
          sourceFile.addClass({
            name: test.name,
            methods: test.methods,
          });
        }
      });

      return sourceFile.getFullText();
    } catch (error) {
      this.logger.error('Error al modificar archivo de test:', error.message);
      throw error;
    }
  }

  /**
   * Crea un nuevo archivo de test
   */
  async createTestFile(filePath: string, content: string): Promise<void> {
    try {
      this.project?.createSourceFile(filePath, content);
      this.logger.log(`Archivo de test creado: ${filePath}`);
    } catch (error) {
      this.logger.error('Error al crear archivo de test:', error.message);
      throw error;
    }
  }

  /**
   * Guarda todos los cambios
   */
  async saveChanges(): Promise<void> {
    try {
      await this.project?.save();
      this.logger.log('Cambios guardados exitosamente');
    } catch (error) {
      this.logger.error('Error al guardar cambios:', error.message);
      throw error;
    }
  }

  /**
   * Guarda el análisis en un archivo JSON en la raíz del proyecto
   */
  private async saveAnalysisToFile(projectPath: string, analysis: CodeAnalysis): Promise<void> {
    try {
      const analysisFilePath = path.join(projectPath, this.ANALYSIS_FILENAME);
      
      const analysisData = {
        timestamp: new Date().toISOString(),
        projectPath,
        analysis,
        metadata: {
          totalFiles: this.project?.getSourceFiles().length || 0,
          totalTests: analysis.existingTests.length,
          totalClasses: analysis.classes.length,
          totalInterfaces: analysis.interfaces.length,
          totalMethods: analysis.methods.length,
          totalPatterns: analysis.patterns.length,
          totalImports: analysis.imports.length,
        }
      };

      await fs.promises.writeFile(
        analysisFilePath, 
        JSON.stringify(analysisData, null, 2),
        'utf8'
      );

      this.logger.log(`Análisis guardado en: ${analysisFilePath}`);
    } catch (error) {
      this.logger.error('Error al guardar análisis:', error.message);
      // No lanzar error para no interrumpir el flujo principal
    }
  }

  /**
   * Carga el análisis desde el archivo JSON si existe
   */
  private async loadAnalysisFromFile(projectPath: string): Promise<CodeAnalysis | null> {
    try {
      const analysisFilePath = path.join(projectPath, this.ANALYSIS_FILENAME);
      
      // Verificar si el archivo existe
      if (!fs.existsSync(analysisFilePath)) {
        return null;
      }

      const fileContent = await fs.promises.readFile(analysisFilePath, 'utf8');
      const analysisData = JSON.parse(fileContent);

      // Verificar que el análisis no sea muy antiguo (opcional)
      const analysisDate = new Date(analysisData.timestamp);
      const hoursSinceAnalysis = (Date.now() - analysisDate.getTime()) / (1000 * 60 * 60);
      
      // Si el análisis tiene más de 24 horas, considerarlo obsoleto
      if (hoursSinceAnalysis > 24) {
        this.logger.log('Análisis existente es obsoleto, realizando nuevo análisis');
        return null;
      }

      this.logger.log(`Análisis cargado desde: ${analysisFilePath} (${hoursSinceAnalysis.toFixed(1)} horas atrás)`);
      return analysisData.analysis;
    } catch (error) {
      this.logger.warn('Error al cargar análisis existente:', error.message);
      return null;
    }
  }

  /**
   * Fuerza un nuevo análisis ignorando el archivo existente
   */
  async forceNewAnalysis(projectPath: string): Promise<CodeAnalysis> {
    try {
      // Eliminar archivo de análisis existente si existe
      const analysisFilePath = path.join(projectPath, this.ANALYSIS_FILENAME);
      if (fs.existsSync(analysisFilePath)) {
        await fs.promises.unlink(analysisFilePath);
        this.logger.log('Archivo de análisis existente eliminado');
      }
    } catch (error) {
      this.logger.warn('Error al eliminar archivo de análisis existente:', error.message);
    }

    // Realizar nuevo análisis
    return this.analyzeProject(projectPath);
  }

  /**
   * Obtiene información del análisis guardado sin realizar nuevo análisis
   */
  async getAnalysisInfo(projectPath: string): Promise<{
    exists: boolean;
    timestamp?: string;
    metadata?: any;
    filePath: string;
  }> {
    try {
      const analysisFilePath = path.join(projectPath, this.ANALYSIS_FILENAME);
      
      if (!fs.existsSync(analysisFilePath)) {
        return {
          exists: false,
          filePath: analysisFilePath,
        };
      }

      const fileContent = await fs.promises.readFile(analysisFilePath, 'utf8');
      const analysisData = JSON.parse(fileContent);

      return {
        exists: true,
        timestamp: analysisData.timestamp,
        metadata: analysisData.metadata,
        filePath: analysisFilePath,
      };
    } catch (error) {
      this.logger.error('Error al obtener información del análisis:', error.message);
      return {
        exists: false,
        filePath: path.join(projectPath, this.ANALYSIS_FILENAME),
      };
    }
  }

  /**
   * Elimina el archivo de análisis
   */
  async clearAnalysis(projectPath: string): Promise<void> {
    try {
      const analysisFilePath = path.join(projectPath, this.ANALYSIS_FILENAME);
      
      if (fs.existsSync(analysisFilePath)) {
        await fs.promises.unlink(analysisFilePath);
        this.logger.log('Archivo de análisis eliminado');
      }
    } catch (error) {
      this.logger.error('Error al eliminar archivo de análisis:', error.message);
      throw error;
    }
  }
} 