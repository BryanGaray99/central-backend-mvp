import { Controller, Post, Get, Body, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { OpenAIConfigService } from '../services/openai-config.service';

/**
 * AI General Controller
 * 
 * Handles general AI operations like OpenAI connection testing and API key management.
 * These endpoints are not project-specific and provide system-wide AI configuration.
 * 
 * @controller AIGeneralController
 */
@Controller('ai')
export class AIGeneralController {
  private readonly logger = new Logger(AIGeneralController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly openAIConfigService: OpenAIConfigService
  ) {}

  /**
   * Tests the connection with OpenAI using the API key from the .env file.
   * 
   * @returns Promise<object> - Connection test result with success status and model count
   * @throws HttpException - If API key is not found or connection fails
   * 
   * @example
   * ```typescript
   * const result = await aiGeneralController.testOpenAIConnection();
   * // Returns: { success: true, message: 'Connection successful', models: 50 }
   * ```
   */
  @Post('test-connection')
  async testOpenAIConnection() {
    try {
      const apiKey = await this.openAIConfigService.getOpenAIKey();
      
      if (!apiKey) {
        throw new HttpException(
          'OpenAI API key not found in .env file',
          HttpStatus.BAD_REQUEST
        );
      }

      const openai = new OpenAI({ apiKey });
      
      // Make a simple call to test the connection
      const response = await openai.models.list();
      
      return {
        success: true,
        message: 'Successful connection with OpenAI',
        models: response.data.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Error testing OpenAI connection: ${error.message}`);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        `Error connecting to OpenAI: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Saves the OpenAI API key to the .env file.
   * 
   * @param body - Request body containing the API key
   * @param body.apiKey - The OpenAI API key to save
   * @returns Promise<object> - Success status and message
   * @throws HttpException - If API key is missing or save operation fails
   * 
   * @example
   * ```typescript
   * const result = await aiGeneralController.saveOpenAIKey({ apiKey: 'sk-...' });
   * // Returns: { success: true, message: 'API key saved successfully' }
   * ```
   */
  @Post('save-api-key')
  async saveOpenAIKey(@Body() body: { apiKey: string }) {
    try {
      if (!body.apiKey || !body.apiKey.trim()) {
        throw new HttpException(
          'API key is required',
          HttpStatus.BAD_REQUEST
        );
      }

      await this.openAIConfigService.saveOpenAIKey(body.apiKey.trim());
      
      return {
        success: true,
        message: 'API key saved successfully',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Error saving OpenAI API key: ${error.message}`);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        `Error saving API key: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Checks the status of the API key from the .env file and tests the connection.
   * 
   * @returns Promise<object> - Status information including configuration and connection status
   * 
   * @example
   * ```typescript
   * const status = await aiGeneralController.checkOpenAIStatus();
   * // Returns: { success: true, configured: true, connected: true, models: 50 }
   * ```
   */
  @Get('check-status')
  async checkOpenAIStatus() {
    try {
      const apiKey = await this.openAIConfigService.getOpenAIKey();
      
      if (!apiKey) {
        return {
          success: false,
          configured: false,
          connected: false,
          message: 'OpenAI API key not found in .env file',
          timestamp: new Date().toISOString()
        };
      }

      // Test the connection with the found API key
      const openai = new OpenAI({ apiKey });
      const response = await openai.models.list();
      
      return {
        success: true,
        configured: true,
        connected: true,
        message: 'OpenAI API key configured and working correctly',
        models: response.data.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Error checking OpenAI status: ${error.message}`);
      
      // If there's an API key but connection fails
      const apiKey = await this.openAIConfigService.getOpenAIKey();
      if (apiKey) {
        return {
          success: false,
          configured: true,
          connected: false,
          message: `API key configured but connection error: ${error.message}`,
          timestamp: new Date().toISOString()
        };
      }
      
      return {
        success: false,
        configured: false,
        connected: false,
        message: 'OpenAI API key not configured',
        timestamp: new Date().toISOString()
      };
    }
  }



}
