-- Migration: Create AI Generations Table
-- Description: Stores AI generation requests and results for tracking

CREATE TABLE IF NOT EXISTS "ai_generations" (
  "id" varchar PRIMARY KEY,
  "generationId" varchar UNIQUE NOT NULL,
  "projectId" varchar NOT NULL,
  "type" varchar(50) DEFAULT 'bdd-test-case',
  "entityName" varchar NOT NULL,
  "method" varchar NOT NULL,
  "scenarioName" varchar NOT NULL,
  "section" varchar DEFAULT 'ecommerce',
  "status" varchar(20) DEFAULT 'pending',
  "requestData" text,
  "generatedCode" text,
  "errorMessage" text,
  "metadata" json,
  "createdAt" datetime DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" datetime DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS "idx_ai_generations_project_id" ON "ai_generations" ("projectId");
CREATE INDEX IF NOT EXISTS "idx_ai_generations_status" ON "ai_generations" ("status");
CREATE INDEX IF NOT EXISTS "idx_ai_generations_generation_id" ON "ai_generations" ("generationId"); 