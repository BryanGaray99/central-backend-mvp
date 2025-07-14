export interface CodeAnalysis {
  existingTests: any[];
  imports: string[];
  patterns: any[];
  classes: any[];
  interfaces: any[];
  methods: any[];
}

export interface TestModifications {
  newTests: any[];
  updatedTests: any[];
  removedTests: any[];
}

export interface ClassAnalysis {
  name: string;
  filePath: string;
  methods: MethodAnalysis[];
  properties: PropertyAnalysis[];
}

export interface MethodAnalysis {
  name: string;
  parameters: ParameterAnalysis[];
  returnType: string;
}

export interface PropertyAnalysis {
  name: string;
  type: string;
}

export interface ParameterAnalysis {
  name: string;
  type: string;
}

export interface InterfaceAnalysis {
  name: string;
  filePath: string;
  properties: PropertyAnalysis[];
}

export interface CodePattern {
  type: string;
  filePath: string;
  pattern: string;
} 