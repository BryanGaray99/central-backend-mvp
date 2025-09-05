-- Migration: 004_create_test_steps_table.sql
-- Description: Create test steps table
-- Created: 2024-01-01

CREATE TABLE IF NOT EXISTS "test_steps" (
    "id" varchar PRIMARY KEY,
    "stepId" varchar NOT NULL UNIQUE,
    "projectId" varchar NOT NULL,
    "section" varchar NOT NULL,
    "entityName" varchar NOT NULL,
    "name" varchar NOT NULL,
    "definition" text NOT NULL,
    "type" varchar NOT NULL,
    "stepType" varchar DEFAULT 'predefined',
    "parameters" text NOT NULL,
    "implementation" text NOT NULL,
    "validation" text,
    "status" varchar DEFAULT 'active',
    "metadata" text,
    "createdAt" datetime DEFAULT (datetime('now')),
    "updatedAt" datetime DEFAULT (datetime('now')),
    FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS "IDX_test_steps_projectId" ON "test_steps" ("projectId");
CREATE INDEX IF NOT EXISTS "IDX_test_steps_stepId" ON "test_steps" ("stepId");
CREATE INDEX IF NOT EXISTS "IDX_test_steps_section" ON "test_steps" ("section");
CREATE INDEX IF NOT EXISTS "IDX_test_steps_entityName" ON "test_steps" ("entityName");
CREATE INDEX IF NOT EXISTS "IDX_test_steps_type" ON "test_steps" ("type");
CREATE INDEX IF NOT EXISTS "IDX_test_steps_status" ON "test_steps" ("status"); 