import { CodeAnalysis } from './ts-morph.interface';

export interface AIGenerationResult {
  success: boolean;
  generatedCode: string;
  validation: {
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  };
  analysis: CodeAnalysis;
  metadata: {
    entityName: string;
    methods: string[];
    generationTime: number;
    modelUsed: string;
  };
}

export interface AIGenerationOptions {
  entityName: string;
  methods: string[];
  analysis: Record<string, any>;
  projectPath?: string;
  scenarios?: string[];
  includeFixtures?: boolean;
  includeSchemas?: boolean;
  refineExisting?: boolean;
}

export interface AIHealthStatus {
  ollamaAvailable: boolean;
  modelsAvailable: string[];
  tsMorphAvailable: boolean;
}

export interface GenerationStats {
  totalGenerations: number;
  successRate: number;
  averageGenerationTime: number;
  mostUsedEntities: string[];
} 