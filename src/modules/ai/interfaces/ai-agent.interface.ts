/**
 * Interface for AI generation requests.
 * Contains all necessary information to generate test cases using AI.
 */
export interface AIGenerationRequest {
  projectId: string;
  entityName: string;
  section: string;
  operation: 'add-scenario' | 'modify-scenario' | 'create-new';
  requirements: string;
  metadata?: Record<string, any>;
}

/**
 * Interface for AI generation responses.
 * Contains the generated code, insertion information, and metadata.
 */
export interface AIGenerationResponse {
  success: boolean;
  data?: {
    newCode: GeneratedCode;
    insertions: CodeInsertion[];
    context?: ProjectContext;
    savedTestCase?: any;
  };
  error?: string;
  metadata?: {
    processingTime: number;
    tokensUsed: number;
    modelUsed: string;
    generationId?: string;
    assistantId?: string;
    threadId?: string;
  };
}

/**
 * Interface for generated code structure.
 * Contains different types of generated test artifacts.
 */
export interface GeneratedCode {
  feature?: string;
  steps?: string;
  tests?: string;
  fixtures?: string;
  schemas?: string;
  types?: string;
  client?: string;
}

/**
 * Interface for code insertion operations.
 * Defines where and how to insert generated code into existing files.
 */
export interface CodeInsertion {
  file: string;
  line: number;
  content: string;
  type: 'scenario' | 'step' | 'test' | 'fixture' | 'schema' | 'type' | 'client';
  description?: string;
}

/**
 * Interface for project context information.
 * Contains patterns, examples, and preferences for AI generation.
 */
export interface ProjectContext {
  projectId: string;
  patterns: {
    namingConventions: string[];
    testStructure: string[];
    commonValidations: string[];
  };
  examples: {
    featureFiles: string[];
    stepFiles: string[];
    testFiles: string[];
  };
  preferences: {
    framework: string;
    language: string;
    style: string;
  };
  lastAnalyzed: Date;
}

/**
 * Interface for file analysis results.
 * Contains parsed file structure and content information.
 */
export interface FileAnalysis {
  filePath: string;
  content: string;
  structure: {
    scenarios: Array<{ line: number; name: string }>;
    steps: Array<{ line: number; name: string }>;
    imports: Array<{ line: number; import: string }>;
  };
}

/**
 * Interface for AI tools.
 * Defines the structure for AI-powered tools and their execution.
 */
export interface AITool {
  name: string;
  description: string;
  execute: (params: any) => Promise<any>;
} 