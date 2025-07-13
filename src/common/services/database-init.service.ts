import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseMigrationService } from './database-migration.service';

@Injectable()
export class DatabaseInitService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseInitService.name);

  constructor(private readonly migrationService: DatabaseMigrationService) {}

  async onModuleInit() {
    try {
      this.logger.log('Inicializando base de datos...');
      await this.migrationService.initializeDatabase();
      this.logger.log('Base de datos inicializada correctamente');
    } catch (error) {
      this.logger.error('Error al inicializar la base de datos:', error);
      throw error;
    }
  }
} 