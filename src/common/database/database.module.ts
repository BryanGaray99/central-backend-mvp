import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseMigrationService } from './services/database-migration.service';
import { DatabaseInitService } from './services/database-init.service';

/**
 * Database Module
 * 
 * Provides database initialization and migration services for the application.
 * Handles SQLite database setup, migrations execution, and automatic database
 * initialization on module startup.
 * 
 * @module DatabaseModule
 */
@Module({
  imports: [ConfigModule],
  providers: [DatabaseMigrationService, DatabaseInitService],
  exports: [DatabaseMigrationService],
})
export class DatabaseModule {} 