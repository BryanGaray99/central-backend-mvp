import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AITestGeneratorService } from '../services/ai/ai-test-generator.service';
import { OllamaService } from '../services/ai/ollama.service';
import { TSMorphService } from '../services/code-manipulation/ts-morph.service';
import { AIFileManagerService } from '../services/ai/ai-file-manager.service';
import { AIProjectValidatorService } from '../services/ai/ai-project-validator.service';
import { AIGenerationOptions } from '../interfaces/ai-test-generator.interface';
import {
  GenerateTestsDto,
  RefineTestsDto,
  GenerateFixturesDto,
  GenerateSchemasDto,
} from '../dto/ai-test-generation.dto';

@ApiTags('ai-test-generation')
@Controller('projects/:projectId/ai-test-generation')
export class AITestGenerationController {
  private readonly logger = new Logger(AITestGenerationController.name);

  constructor(
    private readonly aiTestGeneratorService: AITestGeneratorService,
    private readonly ollamaService: OllamaService,
    private readonly tsMorphService: TSMorphService,
    private readonly aiFileManagerService: AIFileManagerService,
    private readonly aiProjectValidatorService: AIProjectValidatorService,
  ) {}

  @Post('generate')
  @ApiOperation({
    summary: 'Generar casos de prueba con IA',
    description: 'Genera casos de prueba inteligentes usando Ollama y TS-Morph',
  })
  @ApiBody({ type: GenerateTestsDto })
  @ApiResponse({
    status: 201,
    description: 'Tests generados exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Error en la generación',
  })
  async generateTests(
    @Param('projectId') projectId: string,
    @Body() dto: GenerateTestsDto,
  ) {
    try {
      const options: AIGenerationOptions = {
        entityName: dto.entityName,
        methods: dto.methods,
        analysis: dto.analysis,
        projectPath: dto.projectPath,
        scenarios: dto.scenarios,
        includeFixtures: dto.includeFixtures,
        includeSchemas: dto.includeSchemas,
        refineExisting: dto.refineExisting,
      };

      const result = await this.aiTestGeneratorService.generateIntelligentTests(options);

      if (!result.success) {
        throw new HttpException(
          {
            success: false,
            error: {
              statusCode: HttpStatus.BAD_REQUEST,
              message: 'Error en generación de tests con IA',
              details: result.validation.issues,
            },
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        success: true,
        data: {
          generatedCode: result.generatedCode,
          validation: result.validation,
          analysis: result.analysis,
          metadata: result.metadata,
        },
        message: 'Tests generados exitosamente con IA',
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Error interno en generación de tests',
            details: error.message,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('generate-for-method')
  @ApiOperation({
    summary: 'Generar tests para método específico e insertar automáticamente',
    description: 'Genera casos de prueba para un método HTTP específico y los inserta automáticamente en los archivos del proyecto',
  })
  @ApiBody({ type: GenerateTestsDto })
  @ApiResponse({
    status: 201,
    description: 'Tests generados e insertados exitosamente',
  })
  async generateTestsForMethod(
    @Param('projectId') projectId: string,
    @Body() dto: GenerateTestsDto,
  ) {
    try {
      // Obtener información del proyecto desde la base de datos
      const project = await this.aiProjectValidatorService.getProjectFromDatabase(projectId);
      const projectPath = this.aiProjectValidatorService.buildProjectPath(project.name);
      await this.aiProjectValidatorService.validateProjectExists(projectPath);

      // Generar código con IA
      const result = await this.aiTestGeneratorService.generateTestsForMethod(
        dto.entityName,
        dto.methods[0], // Tomar el primer método
        dto.analysis,
        projectPath,
      );

      if (!result.success) {
        throw new HttpException(
          {
            success: false,
            error: {
              statusCode: HttpStatus.BAD_REQUEST,
              message: 'Error en generación de tests para método',
              details: result.validation.issues,
            },
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Insertar código generado en los archivos del proyecto
      const insertionResult = await this.aiFileManagerService.insertGeneratedCodeIntoProject(
        projectPath,
        dto.entityName,
        dto.methods[0],
        result.generatedCode,
        project.name
      );

      return {
        success: true,
        data: {
          generatedCode: result.generatedCode,
          validation: result.validation,
          metadata: result.metadata,
          insertionResult,
          projectPath: `..\\playwright-workspaces\\${project.name}`,
          projectName: project.name,
        },
        message: 'Tests generados e insertados exitosamente para método específico',
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Error interno en generación e inserción de tests para método',
            details: error.message,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('refine')
  @ApiOperation({
    summary: 'Refinar tests existentes',
    description: 'Refina casos de prueba existentes usando IA',
  })
  @ApiBody({ type: RefineTestsDto })
  @ApiResponse({
    status: 200,
    description: 'Tests refinados exitosamente',
  })
  async refineTests(
    @Param('projectId') projectId: string,
    @Body() dto: RefineTestsDto,
  ) {
    try {
      const result = await this.aiTestGeneratorService.refineExistingTests(
        dto.existingCode,
        dto.improvements,
        dto.projectPath,
      );

      if (!result.success) {
        throw new HttpException(
          {
            success: false,
            error: {
              statusCode: HttpStatus.BAD_REQUEST,
              message: 'Error en refinamiento de tests',
              details: result.validation.issues,
            },
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        success: true,
        data: {
          refinedCode: result.generatedCode,
          validation: result.validation,
          metadata: result.metadata,
        },
        message: 'Tests refinados exitosamente',
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Error interno en refinamiento de tests',
            details: error.message,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('generate-fixtures')
  @ApiOperation({
    summary: 'Generar fixtures de datos',
    description: 'Genera fixtures de datos de prueba usando IA',
  })
  @ApiBody({ type: GenerateFixturesDto })
  @ApiResponse({
    status: 201,
    description: 'Fixtures generados exitosamente',
  })
  async generateFixtures(
    @Param('projectId') projectId: string,
    @Body() dto: GenerateFixturesDto,
  ) {
    try {
      const fixtures = await this.aiTestGeneratorService.generateTestFixtures(
        dto.entityName,
        dto.analysis,
      );

      return {
        success: true,
        data: {
          fixtures,
          entityName: dto.entityName,
        },
        message: 'Fixtures generados exitosamente',
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Error en generación de fixtures',
            details: error.message,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('generate-schemas')
  @ApiOperation({
    summary: 'Generar schemas de validación',
    description: 'Genera schemas de validación usando IA',
  })
  @ApiBody({ type: GenerateSchemasDto })
  @ApiResponse({
    status: 201,
    description: 'Schemas generados exitosamente',
  })
  async generateSchemas(
    @Param('projectId') projectId: string,
    @Body() dto: GenerateSchemasDto,
  ) {
    try {
      const schemas = await this.aiTestGeneratorService.generateValidationSchemas(
        dto.entityName,
        dto.analysis,
      );

      return {
        success: true,
        data: {
          schemas,
          entityName: dto.entityName,
        },
        message: 'Schemas generados exitosamente',
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Error en generación de schemas',
            details: error.message,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('health')
  @ApiOperation({
    summary: 'Verificar estado del sistema de IA',
    description: 'Verifica la disponibilidad de Ollama y TS-Morph',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado del sistema de IA',
  })
  async checkAIHealth(@Param('projectId') projectId: string) {
    try {
      const health = await this.aiTestGeneratorService.checkAIHealth();

      return {
        success: true,
        data: {
          ...health,
          projectId,
          timestamp: new Date().toISOString(),
        },
        message: 'Estado del sistema de IA verificado',
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Error al verificar estado del sistema de IA',
            details: error.message,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('models')
  @ApiOperation({
    summary: 'Obtener modelos disponibles',
    description: 'Obtiene la lista de modelos disponibles en Ollama',
  })
  @ApiResponse({
    status: 200,
    description: 'Modelos disponibles',
  })
  async getAvailableModels(@Param('projectId') projectId: string) {
    try {
      const models = await this.ollamaService.getAvailableModels();

      return {
        success: true,
        data: {
          models,
          totalModels: models.length,
          projectId,
        },
        message: 'Modelos disponibles obtenidos',
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Error al obtener modelos disponibles',
            details: error.message,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Obtener estadísticas de generación',
    description: 'Obtiene estadísticas de generación de tests con IA',
  })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas de generación',
  })
  async getGenerationStats(@Param('projectId') projectId: string) {
    try {
      const stats = await this.aiTestGeneratorService.getGenerationStats();

      return {
        success: true,
        data: {
          ...stats,
          projectId,
        },
        message: 'Estadísticas de generación obtenidas',
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Error al obtener estadísticas de generación',
            details: error.message,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('analyze-project')
  @ApiOperation({
    summary: 'Analizar proyecto con TS-Morph',
    description: 'Analiza el proyecto usando TS-Morph para extraer patrones. Usa la información de la base de datos para construir la ruta del proyecto.',
  })
  @ApiResponse({
    status: 200,
    description: 'Análisis del proyecto completado',
  })
  async analyzeProject(@Param('projectId') projectId: string) {
    try {
      // Obtener información del proyecto desde la base de datos
      const project = await this.aiProjectValidatorService.getProjectFromDatabase(projectId);
      
      // Construir la ruta del proyecto usando la configuración
      const projectPath = this.aiProjectValidatorService.buildProjectPath(project.name);
      
      // Verificar que el proyecto existe en el sistema de archivos
      await this.aiProjectValidatorService.validateProjectExists(projectPath);

      const analysis = await this.tsMorphService.analyzeProject(projectPath);

      return {
        success: true,
        data: {
          success: true,
          data: {
            analysis,
            projectId,
            projectPath: `..\\playwright-workspaces\\${project.name}`,
            projectName: project.name,
          },
          message: 'Análisis del proyecto completado',
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Error al analizar el proyecto',
            details: error.message,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('analysis-info')
  @ApiOperation({
    summary: 'Obtener información del análisis guardado',
    description: 'Obtiene información sobre el análisis guardado en archivo JSON sin realizar nuevo análisis.',
  })
  @ApiResponse({
    status: 200,
    description: 'Información del análisis obtenida',
  })
  async getAnalysisInfo(@Param('projectId') projectId: string) {
    try {
      const project = await this.aiProjectValidatorService.getProjectFromDatabase(projectId);
      const projectPath = this.aiProjectValidatorService.buildProjectPath(project.name);
      await this.aiProjectValidatorService.validateProjectExists(projectPath);

      const analysisInfo = await this.tsMorphService.getAnalysisInfo(projectPath);

      return {
        success: true,
        data: {
          success: true,
          data: {
            analysisInfo,
            projectId,
            projectPath: `..\\playwright-workspaces\\${project.name}`,
            projectName: project.name,
          },
          message: 'Información del análisis obtenida',
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Error al obtener información del análisis',
            details: error.message,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('force-new-analysis')
  @ApiOperation({
    summary: 'Forzar nuevo análisis del proyecto',
    description: 'Elimina el análisis existente y realiza un nuevo análisis completo del proyecto.',
  })
  @ApiResponse({
    status: 200,
    description: 'Nuevo análisis completado',
  })
  async forceNewAnalysis(@Param('projectId') projectId: string) {
    try {
      const project = await this.aiProjectValidatorService.getProjectFromDatabase(projectId);
      const projectPath = this.aiProjectValidatorService.buildProjectPath(project.name);
      await this.aiProjectValidatorService.validateProjectExists(projectPath);

      const analysis = await this.tsMorphService.forceNewAnalysis(projectPath);

      return {
        success: true,
        data: {
          success: true,
          data: {
            analysis,
            projectId,
            projectPath: `..\\playwright-workspaces\\${project.name}`,
            projectName: project.name,
            message: 'Nuevo análisis completado',
          },
          message: 'Nuevo análisis del proyecto completado',
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Error al forzar nuevo análisis',
            details: error.message,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('clear-analysis')
  @ApiOperation({
    summary: 'Eliminar análisis guardado',
    description: 'Elimina el archivo de análisis guardado del proyecto.',
  })
  @ApiResponse({
    status: 200,
    description: 'Análisis eliminado',
  })
  async clearAnalysis(@Param('projectId') projectId: string) {
    try {
      const project = await this.aiProjectValidatorService.getProjectFromDatabase(projectId);
      const projectPath = this.aiProjectValidatorService.buildProjectPath(project.name);
      await this.aiProjectValidatorService.validateProjectExists(projectPath);

      await this.tsMorphService.clearAnalysis(projectPath);

      return {
        success: true,
        data: {
          success: true,
          data: {
            projectId,
            projectPath: `..\\playwright-workspaces\\${project.name}`,
            projectName: project.name,
          },
          message: 'Análisis eliminado exitosamente',
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Error al eliminar análisis',
            details: error.message,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


} 