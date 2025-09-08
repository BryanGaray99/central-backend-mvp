import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';

/**
 * OpenAI Configuration Service
 * 
 * Manages OpenAI API key configuration and retrieval from the .env file.
 * Handles reading, writing, and validating OpenAI API keys for the application.
 * 
 * @service OpenAIConfigService
 */
@Injectable()
export class OpenAIConfigService {
  private readonly logger = new Logger(OpenAIConfigService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Gets the OpenAI API key from the .env file.
   * 
   * @returns Promise<string | null> - The API key or null if not found
   * 
   * @example
   * ```typescript
   * const apiKey = await openAIConfigService.getOpenAIKey();
   * if (apiKey) {
   *   console.log('API key found');
   * }
   * ```
   */
  async getOpenAIKey(): Promise<string | null> {
    try {
      const envFilePath = await this.getEnvFilePath();
      const envContent = await fs.readFile(envFilePath, 'utf-8');
      const envConfig = dotenv.parse(envContent);
      
      return envConfig.OPENAI_API_KEY || null;
    } catch (error) {
      this.logger.error(`Error reading OpenAI API key: ${error.message}`);
      return null;
    }
  }

  /**
   * Saves the OpenAI API key to the .env file.
   * 
   * @param apiKey - The API key to save
   * @returns Promise<void>
   * @throws Error - If saving fails
   * 
   * @example
   * ```typescript
   * await openAIConfigService.saveOpenAIKey('sk-...');
   * ```
   */
  async saveOpenAIKey(apiKey: string): Promise<void> {
    try {
      const envFilePath = await this.getEnvFilePath();
      
      // Read existing .env file if it exists
      let envContent = '';
      try {
        envContent = await fs.readFile(envFilePath, 'utf-8');
      } catch {
        // File doesn't exist, create a new one
        envContent = '';
      }
      
      // Parse existing content
      const envConfig = dotenv.parse(envContent);
      
      // Update or add the API key
      envConfig.OPENAI_API_KEY = apiKey;
      
      // Convert back to .env format
      const newEnvContent = Object.entries(envConfig)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
      
      // Ensure the directory exists
      const envDir = path.dirname(envFilePath);
      await fs.mkdir(envDir, { recursive: true });
      
      // Write the file
      await fs.writeFile(envFilePath, newEnvContent, 'utf-8');
      
      this.logger.log(`OpenAI API key saved to: ${envFilePath}`);
    } catch (error) {
      this.logger.error(`Error saving OpenAI API key: ${error.message}`);
      throw new Error(`Could not save API key: ${error.message}`);
    }
  }

  /**
   * Verifies if the API key is configured.
   * 
   * @returns Promise<boolean> - True if API key is configured, false otherwise
   * 
   * @example
   * ```typescript
   * const isConfigured = await openAIConfigService.isConfigured();
   * if (isConfigured) {
   *   console.log('API key is configured');
   * }
   * ```
   */
  async isConfigured(): Promise<boolean> {
    const apiKey = await this.getOpenAIKey();
    return !!apiKey;
  }

  /**
   * Gets the path to the .env file.
   * 
   * @private
   * @returns Promise<string> - The path to the .env file
   */
  private async getEnvFilePath(): Promise<string> {
    const workspacesPath = this.configService.get('PLAYWRIGHT_WORKSPACES_PATH') || '../playwright-workspaces';
    let envPath = workspacesPath;
    
    if (!path.isAbsolute(envPath)) {
      envPath = path.resolve(process.cwd(), envPath);
    }
    
    return path.join(envPath, '.env');
  }
}
