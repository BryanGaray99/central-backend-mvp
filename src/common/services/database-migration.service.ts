import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as sqlite3 from 'sqlite3';

@Injectable()
export class DatabaseMigrationService {
  private readonly logger = new Logger(DatabaseMigrationService.name);
  private readonly migrationsPath = path.join(__dirname, '..', 'db-migrations');
  private dbPath: string;

  constructor(private readonly configService: ConfigService) {
    // Cambiar la ruta de la base de datos a playwright-workspaces
    const workspacesPath = this.configService.get('PLAYWRIGHT_WORKSPACES_PATH') || '../playwright-workspaces';
    this.dbPath = path.resolve(workspacesPath, 'central-backend.sqlite');
  }

  async initializeDatabase(): Promise<void> {
    try {
      this.logger.log('Inicializando base de datos...');
      
      // Asegurar que el directorio existe
      await this.ensureDirectoryExists();
      
      // Crear o conectar a la base de datos
      await this.createDatabase();
      
      // Ejecutar migraciones
      await this.runMigrations();
      
      this.logger.log('Base de datos inicializada correctamente');
    } catch (error) {
      this.logger.error('Error al inicializar la base de datos:', error);
      throw error;
    }
  }

  private async ensureDirectoryExists(): Promise<void> {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      this.logger.log(`Directorio creado: ${dir}`);
    }
  }

  private async createDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          this.logger.error('Error al crear/conectar la base de datos:', err);
          reject(err);
        } else {
          this.logger.log(`Base de datos conectada: ${this.dbPath}`);
          db.close();
          resolve();
        }
      });
    });
  }

  private async runMigrations(): Promise<void> {
    const db = new sqlite3.Database(this.dbPath);
    
    try {
      // Crear tabla de migraciones si no existe
      await this.createMigrationsTable(db);
      
      // Obtener migraciones ejecutadas
      const executedMigrations = await this.getExecutedMigrations(db);
      
      // Obtener archivos de migración
      const migrationFiles = await this.getMigrationFiles();
      
      // Ejecutar migraciones pendientes
      for (const file of migrationFiles) {
        if (!executedMigrations.includes(file)) {
          await this.executeMigration(db, file);
        }
      }
      
      this.logger.log('Migraciones ejecutadas correctamente');
    } finally {
      db.close();
    }
  }

  private async createMigrationsTable(db: sqlite3.Database): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS "migrations" (
          "id" varchar PRIMARY KEY,
          "filename" varchar NOT NULL,
          "executedAt" datetime DEFAULT (datetime('now'))
        )
      `;
      
      db.run(sql, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private async getExecutedMigrations(db: sqlite3.Database): Promise<string[]> {
    return new Promise((resolve, reject) => {
      db.all('SELECT filename FROM migrations ORDER BY filename', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve((rows as any[]).map(row => row.filename));
        }
      });
    });
  }

  private async getMigrationFiles(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      fs.readdir(this.migrationsPath, (err, files) => {
        if (err) {
          reject(err);
        } else {
          const sqlFiles = files
            .filter(file => file.endsWith('.sql'))
            .sort();
          resolve(sqlFiles);
        }
      });
    });
  }

  private async executeMigration(db: sqlite3.Database, filename: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const filePath = path.join(this.migrationsPath, filename);
      
      fs.readFile(filePath, 'utf8', (err, content) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Ejecutar las sentencias SQL
        db.exec(content, (err) => {
          if (err) {
            this.logger.error(`Error ejecutando migración ${filename}:`, err);
            reject(err);
            return;
          }
          
          // Registrar la migración como ejecutada
          const insertSql = 'INSERT INTO migrations (id, filename) VALUES (?, ?)';
          const migrationId = filename.replace('.sql', '');
          
          db.run(insertSql, [migrationId, filename], (err) => {
            if (err) {
              reject(err);
            } else {
              this.logger.log(`Migración ejecutada: ${filename}`);
              resolve();
            }
          });
        });
      });
    });
  }

  getDatabasePath(): string {
    return this.dbPath;
  }
} 