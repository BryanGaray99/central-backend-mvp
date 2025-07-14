export interface OllamaRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
  };
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_duration?: number;
  eval_duration?: number;
}

export interface TestCaseContext {
  entityName: string;
  methods: string[];
  analysis: Record<string, any>;
  projectPath?: string;
  existingPatterns?: any[];
}

export interface CodeValidationResult {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
} 