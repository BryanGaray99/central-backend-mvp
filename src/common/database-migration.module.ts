import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseMigrationService } from './services/database-migration.service';
import { DatabaseInitService } from './services/database-init.service';

@Module({
  imports: [ConfigModule],
  providers: [DatabaseMigrationService, DatabaseInitService],
  exports: [DatabaseMigrationService],
})
export class DatabaseMigrationModule {} 