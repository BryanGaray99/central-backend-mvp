export interface AIGenerationRequest {
  projectId: string;
  entityName: string;
  section: string;
  operation: 'add-scenario' | 'modify-scenario' | 'create-new';
  requirements: string;
  metadata?: Record<string, any>;
}

export interface AIGenerationResponse {
  success: boolean;
  data?: {
    newCode: GeneratedCode;
    insertions: CodeInsertion[];
    context?: ProjectContext;
  };
  error?: string;
  metadata?: {
    processingTime: number;
    tokensUsed: number;
    modelUsed: string;
    generationId?: string;
  };
}

export interface GeneratedCode {
  feature?: string;
  steps?: string;
  tests?: string;
  fixtures?: string;
  schemas?: string;
  types?: string;
  client?: string;
}

export interface CodeInsertion {
  file: string;
  line: number;
  content: string;
  type: 'scenario' | 'step' | 'test' | 'fixture' | 'schema' | 'type' | 'client';
  description?: string;
}

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

export interface FileAnalysis {
  filePath: string;
  content: string;
  structure: {
    scenarios: Array<{ line: number; name: string }>;
    steps: Array<{ line: number; name: string }>;
    imports: Array<{ line: number; import: string }>;
  };
}

export interface AITool {
  name: string;
  description: string;
  execute: (params: any) => Promise<any>;
} 