import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class HooksUpdaterService {
  private readonly logger = new Logger(HooksUpdaterService.name);

  /**
   * Updates the hooks.ts file to import and configure the step file and client for the generated entity
   */
  async updateHooksFile(projectPath: string, entityName: string, section: string): Promise<void> {
    const hooksPath = path.join(projectPath, 'src', 'steps', 'hooks.ts');
    if (!fs.existsSync(hooksPath)) {
      this.logger.warn(`Hooks file not found at ${hooksPath}`);
      return;
    }
    try {
      let hooksContent = fs.readFileSync(hooksPath, 'utf8');
      // 1. Import the entity client if it doesn't exist
      const clientImport = `import { ${entityName}Client } from '../api/${section}/${entityName.toLowerCase()}.client';`;
      if (!hooksContent.includes(clientImport)) {
        // Insert after existing imports
        const importLines = hooksContent.split('\n');
        let lastImport = importLines.findIndex(line => line.startsWith('import') && !line.includes('@cucumber/cucumber'));
        if (lastImport === -1) lastImport = 1;
        importLines.splice(lastImport + 1, 0, clientImport);
        hooksContent = importLines.join('\n');
      }
      // 2. Declare global variable for the client
      const clientVar = `export let ${entityName.toLowerCase()}Client: ${entityName}Client;`;
      if (!hooksContent.includes(clientVar)) {
        hooksContent = hooksContent.replace('// Test data storage', `// Test data storage\n${clientVar}`);
      }
      // 3. Add specific storage in testData
      const storageVar = `  created${entityName}s: new Map<string, any>(),`;
      if (!hooksContent.includes(storageVar)) {
        hooksContent = hooksContent.replace('createdEntities: new Map<string, any>(),', `createdEntities: new Map<string, any>(),\n${storageVar}`);
      }
      // 4. Initialize the client in BeforeAll
      const beforeAllInit = `${entityName.toLowerCase()}Client = new ${entityName}Client();`;
      if (!hooksContent.includes(beforeAllInit)) {
        hooksContent = hooksContent.replace('console.log(\'🚀 Initializing test environment for BDD tests...\');', `console.log('🚀 Initializing test environment for BDD tests...');\n  ${beforeAllInit}\n  await ${entityName.toLowerCase()}Client.init();`);
      }
      // 5. Clean storage in After
      const afterCleanup = `    testData.created${entityName}s.clear();`;
      if (!hooksContent.includes(afterCleanup)) {
        hooksContent = hooksContent.replace('testData.createdEntities.clear();', `testData.createdEntities.clear();\n${afterCleanup}`);
      }
      // 6. Dispose client in AfterAll
      const afterAllDispose = `  await ${entityName.toLowerCase()}Client?.dispose();`;
      if (!hooksContent.includes(afterAllDispose)) {
        hooksContent = hooksContent.replace('console.log(\'✅ Test environment cleaned up successfully\');', `await ${entityName.toLowerCase()}Client?.dispose();\n  console.log('✅ Test environment cleaned up successfully');`);
      }
      // 7. Import the entity step file (if exists)
      const stepImport = `import '../${section}/${entityName.toLowerCase()}.steps';`;
      if (!hooksContent.includes(stepImport)) {
        // Insert at the end of imports
        const importLines = hooksContent.split('\n');
        let lastImport = importLines.reduce((acc, line, idx) => line.startsWith('import') ? idx : acc, 0);
        importLines.splice(lastImport + 1, 0, stepImport);
        hooksContent = importLines.join('\n');
      }
      // Save the updated file
      fs.writeFileSync(hooksPath, hooksContent, 'utf8');
      this.logger.debug(`✅ hooks.ts updated for entity ${entityName}`);
    } catch (error) {
      this.logger.error(`Error updating hooks.ts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Removes imports and configurations of an endpoint from the hooks.ts file when deleted
   */
  async removeFromHooksFile(projectPath: string, entityName: string, section: string): Promise<void> {
    const hooksPath = path.join(projectPath, 'src', 'steps', 'hooks.ts');
    if (!fs.existsSync(hooksPath)) {
      this.logger.warn(`Hooks file not found at ${hooksPath}`);
      return;
    }
    
    try {
      let hooksContent = fs.readFileSync(hooksPath, 'utf8');
      const lines = hooksContent.split('\n');
      const updatedLines: string[] = [];
      
      // Patterns to remove
      const patternsToRemove = [
        `import { ${entityName}Client } from '../api/${section}/${entityName.toLowerCase()}.client';`,
        `export let ${entityName.toLowerCase()}Client: ${entityName}Client;`,
        `  created${entityName}s: new Map<string, any>(),`,
        `  ${entityName.toLowerCase()}Client = new ${entityName}Client();`,
        `  await ${entityName.toLowerCase()}Client.init();`,
        `    testData.created${entityName}s.clear();`,
        `  await ${entityName.toLowerCase()}Client?.dispose();`,
        `import '../${section}/${entityName.toLowerCase()}.steps';`
      ];

      let skipNextLine = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        // Check if this line should be removed
        const shouldRemove = patternsToRemove.some(pattern => 
          trimmedLine.includes(pattern.trim())
        );
        
        // Check if the next line should be removed (for lines with await)
        if (shouldRemove) {
          this.logger.debug(`Removing line: ${trimmedLine}`);
          continue;
        }
        
        // Check if this line contains a pattern that requires removing the next line
        if (trimmedLine.includes(`${entityName.toLowerCase()}Client = new ${entityName}Client();`)) {
          // Remove this line and the next (await init)
          continue;
        }
        
        // Check if this line contains a pattern that requires removing the previous line
        if (trimmedLine.includes(`await ${entityName.toLowerCase()}Client.init();`)) {
          // Remove this line
          continue;
        }
        
        updatedLines.push(line);
      }
      
      // Clean consecutive empty lines
      const cleanedLines = updatedLines.filter((line, index) => {
        if (line.trim() === '') {
          // Keep only one consecutive empty line
          return index === 0 || updatedLines[index - 1].trim() !== '';
        }
        return true;
      });
      
      // Write the updated file
      const updatedContent = cleanedLines.join('\n');
      fs.writeFileSync(hooksPath, updatedContent, 'utf8');
      
      this.logger.debug(`✅ Removed ${entityName} configurations from hooks.ts`);
    } catch (error) {
      this.logger.error(`Error removing ${entityName} from hooks.ts: ${error.message}`);
      throw error;
    }
  }
}
