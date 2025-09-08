import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseMigrationService } from './database-migration.service';

/**
 * Database Initialization Service
 * 
 * Handles automatic database initialization when the module starts.
 * Executes database migrations and ensures the database is properly
 * set up before the application becomes available.
 * 
 * @class DatabaseInitService
 */
@Injectable()
export class DatabaseInitService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseInitService.name);

  /**
   * Creates an instance of DatabaseInitService.
   * 
   * @param migrationService - Service responsible for database migrations
   */
  constructor(private readonly migrationService: DatabaseMigrationService) {}

  /**
   * Initializes the database when the module starts.
   * 
   * Executes database migrations and logs the initialization process.
   * Throws an error if initialization fails.
   * 
   * @throws {Error} When database initialization fails
   * 
   * @example
   * ```typescript
   * // This method is automatically called by NestJS on module initialization
   * await databaseInitService.onModuleInit();
   * ```
   */
  async onModuleInit() {
    try {
      this.logger.log('Initializing database...');
      await this.migrationService.initializeDatabase();
      this.logger.log('Database initialized successfully');
    } catch (error) {
      this.logger.error('Error initializing database:', error);
      throw error;
    }
  }
} 