import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';

@Injectable()
export class OpenAIConfigService {
  private readonly logger = new Logger(OpenAIConfigService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Obtiene la API key de OpenAI desde el archivo .env
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
   * Guarda la API key de OpenAI en el archivo .env
   */
  async saveOpenAIKey(apiKey: string): Promise<void> {
    try {
      const envFilePath = await this.getEnvFilePath();
      
      // Leer el archivo .env existente si existe
      let envContent = '';
      try {
        envContent = await fs.readFile(envFilePath, 'utf-8');
      } catch {
        // El archivo no existe, crear uno nuevo
        envContent = '';
      }
      
      // Parsear el contenido existente
      const envConfig = dotenv.parse(envContent);
      
      // Actualizar o agregar la API key
      envConfig.OPENAI_API_KEY = apiKey;
      
      // Convertir de vuelta a formato .env
      const newEnvContent = Object.entries(envConfig)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
      
      // Asegurar que el directorio existe
      const envDir = path.dirname(envFilePath);
      await fs.mkdir(envDir, { recursive: true });
      
      // Escribir el archivo
      await fs.writeFile(envFilePath, newEnvContent, 'utf-8');
      
      this.logger.log(`OpenAI API key guardada en: ${envFilePath}`);
    } catch (error) {
      this.logger.error(`Error saving OpenAI API key: ${error.message}`);
      throw new Error(`No se pudo guardar la API key: ${error.message}`);
    }
  }

  /**
   * Verifica si la API key está configurada
   */
  async isConfigured(): Promise<boolean> {
    const apiKey = await this.getOpenAIKey();
    return !!apiKey;
  }

  /**
   * Obtiene la ruta del archivo .env
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
