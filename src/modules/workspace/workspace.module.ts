import { Module } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';

/**
 * Workspace module that provides workspace management functionality.
 * 
 * This module handles the creation, deletion, and management of Playwright testing workspaces.
 * It provides services for workspace lifecycle management and file system operations.
 * 
 * @module WorkspaceModule
 * @since 1.0.0
 */
@Module({
  providers: [WorkspaceService],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
