import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as sqlite3 from 'sqlite3';

/**
 * Database Migration Service
 * 
 * Handles SQLite database creation, migration execution, and database schema management.
 * Provides functionality to initialize databases, run migrations from SQL files,
 * and track migration execution status.
 * 
 * @class DatabaseMigrationService
 */
@Injectable()
export class DatabaseMigrationService {
  private readonly logger = new Logger(DatabaseMigrationService.name);
  private readonly migrationsPath = path.join(__dirname, '..', 'migrations');
  private dbPath: string;

  /**
   * Creates an instance of DatabaseMigrationService.
   * 
   * @param configService - Configuration service for accessing environment variables
   */
  constructor(private readonly configService: ConfigService) {
    // Change database path to playwright-workspaces
    const workspacesPath = this.configService.get('PLAYWRIGHT_WORKSPACES_PATH') || '../playwright-workspaces';
    this.dbPath = path.resolve(workspacesPath, 'central-backend.sqlite');
  }

  /**
   * Initializes the database by creating directories, database file, and running migrations.
   * 
   * @returns Promise that resolves when database initialization is complete
   * @throws {Error} When database initialization fails
   * 
   * @example
   * ```typescript
   * await migrationService.initializeDatabase();
   * ```
   */
  async initializeDatabase(): Promise<void> {
    try {
      this.logger.log('Initializing database...');
      
      // Ensure directory exists
      await this.ensureDirectoryExists();
      
      // Create or connect to database
      await this.createDatabase();
      
      // Execute migrations
      await this.runMigrations();
      
      this.logger.log('Database initialized successfully');
    } catch (error) {
      this.logger.error('Error initializing database:', error);
      throw error;
    }
  }

  /**
   * Ensures the database directory exists, creating it if necessary.
   * 
   * @private
   * @returns Promise that resolves when directory is ensured
   */
  private async ensureDirectoryExists(): Promise<void> {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      this.logger.log(`Directory created: ${dir}`);
    }
  }

  /**
   * Creates or connects to the SQLite database.
   * 
   * @private
   * @returns Promise that resolves when database connection is established
   * @throws {Error} When database connection fails
   */
  private async createDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          this.logger.error('Error creating/connecting to database:', err);
          reject(err);
        } else {
          this.logger.log(`Database connected: ${this.dbPath}`);
          db.close();
          resolve();
        }
      });
    });
  }

  /**
   * Runs all pending database migrations.
   * 
   * Creates migrations table if it doesn't exist, gets executed migrations,
   * and executes any pending migration files.
   * 
   * @private
   * @returns Promise that resolves when all migrations are executed
   */
  private async runMigrations(): Promise<void> {
    const db = new sqlite3.Database(this.dbPath);
    
    try {
      // Create migrations table if it doesn't exist
      await this.createMigrationsTable(db);
      
      // Get executed migrations
      const executedMigrations = await this.getExecutedMigrations(db);
      
      // Get migration files
      const migrationFiles = await this.getMigrationFiles();
      
      // Execute pending migrations
      for (const file of migrationFiles) {
        if (!executedMigrations.includes(file)) {
          await this.executeMigration(db, file);
        }
      }
      
      this.logger.log('Migrations executed successfully');
    } finally {
      db.close();
    }
  }

  /**
   * Creates the migrations tracking table if it doesn't exist.
   * 
   * @private
   * @param db - SQLite database instance
   * @returns Promise that resolves when table is created
   * @throws {Error} When table creation fails
   */
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

  /**
   * Retrieves the list of already executed migrations.
   * 
   * @private
   * @param db - SQLite database instance
   * @returns Promise that resolves with array of executed migration filenames
   * @throws {Error} When query fails
   */
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

  /**
   * Retrieves all SQL migration files from the migrations directory.
   * 
   * @private
   * @returns Promise that resolves with array of migration filenames
   * @throws {Error} When directory reading fails
   */
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

  /**
   * Executes a single migration file and records it as executed.
   * 
   * @private
   * @param db - SQLite database instance
   * @param filename - Name of the migration file to execute
   * @returns Promise that resolves when migration is executed and recorded
   * @throws {Error} When migration execution or recording fails
   */
  private async executeMigration(db: sqlite3.Database, filename: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const filePath = path.join(this.migrationsPath, filename);
      
      fs.readFile(filePath, 'utf8', (err, content) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Execute SQL statements
        db.exec(content, (err) => {
          if (err) {
            this.logger.error(`Error executing migration ${filename}:`, err);
            reject(err);
            return;
          }
          
          // Record migration as executed
          const insertSql = 'INSERT INTO migrations (id, filename) VALUES (?, ?)';
          const migrationId = filename.replace('.sql', '');
          
          db.run(insertSql, [migrationId, filename], (err) => {
            if (err) {
              reject(err);
            } else {
              this.logger.log(`Migration executed: ${filename}`);
              resolve();
            }
          });
        });
      });
    });
  }

  /**
   * Gets the current database file path.
   * 
   * @returns The absolute path to the SQLite database file
   * 
   * @example
   * ```typescript
   * const dbPath = migrationService.getDatabasePath();
   * console.log(`Database located at: ${dbPath}`);
   * ```
   */
  getDatabasePath(): string {
    return this.dbPath;
  }
} 