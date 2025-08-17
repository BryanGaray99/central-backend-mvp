-- Migration: Create AI Suggestions Table
-- Description: Stores AI-generated test case suggestions for projects

CREATE TABLE IF NOT EXISTS "ai_suggestions" (
  "id" varchar PRIMARY KEY,
  "suggestionId" varchar UNIQUE NOT NULL,
  "projectId" varchar NOT NULL,
  "entityName" varchar NOT NULL,
  "section" varchar NOT NULL,
  "requirements" text NOT NULL,
  "suggestions" json NOT NULL,
  "totalSuggestions" integer DEFAULT 0,
  "assistantId" varchar,
  "threadId" varchar,
  "runId" varchar,
  "processingTime" integer,
  "status" varchar(20) DEFAULT 'completed',
  "errorMessage" text,
  "metadata" json,
  "createdAt" datetime DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" datetime DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS "idx_ai_suggestions_project_id" ON "ai_suggestions" ("projectId");
CREATE INDEX IF NOT EXISTS "idx_ai_suggestions_entity" ON "ai_suggestions" ("entityName");
CREATE INDEX IF NOT EXISTS "idx_ai_suggestions_section" ON "ai_suggestions" ("section");
CREATE INDEX IF NOT EXISTS "idx_ai_suggestions_created_at" ON "ai_suggestions" ("createdAt");
CREATE INDEX IF NOT EXISTS "idx_ai_suggestions_suggestion_id" ON "ai_suggestions" ("suggestionId");
