import { Controller, Post, Get, Body, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { OpenAIConfigService } from '../services/openai-config.service';

@Controller('ai')
export class AIGeneralController {
  private readonly logger = new Logger(AIGeneralController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly openAIConfigService: OpenAIConfigService
  ) {}

  /**
   * Prueba la conexión con OpenAI usando el token del archivo .env
   */
  @Post('test-connection')
  async testOpenAIConnection() {
    try {
      const apiKey = await this.openAIConfigService.getOpenAIKey();
      
      if (!apiKey) {
        throw new HttpException(
          'OpenAI API key no encontrada en el archivo .env',
          HttpStatus.BAD_REQUEST
        );
      }

      const openai = new OpenAI({ apiKey });
      
      // Hacer una llamada simple para probar la conexión
      const response = await openai.models.list();
      
      return {
        success: true,
        message: 'Conexión exitosa con OpenAI',
        models: response.data.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Error testing OpenAI connection: ${error.message}`);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        `Error al conectar con OpenAI: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Guarda la API key de OpenAI
   */
  @Post('save-api-key')
  async saveOpenAIKey(@Body() body: { apiKey: string }) {
    try {
      if (!body.apiKey || !body.apiKey.trim()) {
        throw new HttpException(
          'API key es requerida',
          HttpStatus.BAD_REQUEST
        );
      }

      await this.openAIConfigService.saveOpenAIKey(body.apiKey.trim());
      
      return {
        success: true,
        message: 'API key guardada exitosamente',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Error saving OpenAI API key: ${error.message}`);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        `Error al guardar la API key: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Health check para AI
   */
  @Get('health')
  async getAIHealth() {
    try {
      const apiKey = await this.openAIConfigService.getOpenAIKey();
      const hasApiKey = !!apiKey;
      
      return {
        status: 'healthy',
        ai: {
          openai: {
            configured: hasApiKey,
            status: hasApiKey ? 'ready' : 'not_configured'
          }
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        ai: {
          openai: {
            configured: false,
            status: 'error',
            error: error.message
          }
        },
        timestamp: new Date().toISOString()
      };
    }
  }


}
