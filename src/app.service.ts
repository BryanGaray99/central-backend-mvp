/**
 * Main Application Service
 * 
 * Basic service for the Central Backend MVP application that provides
 * simple utility methods for the main application controller.
 * 
 * @service AppService
 * @version 1.0.0
 * @author Central Backend MVP Team
 */

import { Injectable } from '@nestjs/common';

/**
 * Main Application Service
 * 
 * Provides basic application-level services and utility methods.
 * Currently contains a simple welcome message method.
 * 
 * @class AppService
 */
@Injectable()
export class AppService {
  /**
   * Returns a welcome message for the application.
   * 
   * @returns string - Welcome message
   * 
   * @example
   * ```typescript
   * const message = appService.getHello();
   * console.log(message); // "Omega Testing!"
   * ```
   */
  getHello(): string {
    return 'Omega Testing!';
  }
}
