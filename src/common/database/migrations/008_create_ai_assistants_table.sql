-- Migration: 008_create_ai_assistants_table.sql
-- Description: Create AI assistants table
-- Created: 2024-01-01

CREATE TABLE IF NOT EXISTS "ai_assistants" (
    "id" integer PRIMARY KEY AUTOINCREMENT,
    "project_id" varchar NOT NULL,
    "assistant_id" varchar NOT NULL UNIQUE,
    "vector_store_id" varchar, -- Ya no se usa, mantener por compatibilidad
    "file_ids" text, -- JSON array de file_ids
    "instructions" text,
    "tools" text, -- JSON array de tools
    "model" varchar DEFAULT 'gpt-4.1-nano',
    "status" varchar DEFAULT 'active',
    "created_at" datetime DEFAULT (datetime('now')),
    "updated_at" datetime DEFAULT (datetime('now')),
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS "IDX_ai_assistants_project_id" ON "ai_assistants" ("project_id");
CREATE INDEX IF NOT EXISTS "IDX_ai_assistants_assistant_id" ON "ai_assistants" ("assistant_id");
CREATE INDEX IF NOT EXISTS "IDX_ai_assistants_status" ON "ai_assistants" ("status"); 