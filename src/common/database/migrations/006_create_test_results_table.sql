-- Migration: 006_create_test_results_table.sql
-- Description: Create test results table
-- Created: 2024-01-01

CREATE TABLE IF NOT EXISTS "test_results" (
    "id" varchar PRIMARY KEY,
    "executionId" varchar NOT NULL,
    "scenarioName" varchar NOT NULL,
    "scenarioTags" text,
    "status" varchar DEFAULT 'failed',
    "duration" integer DEFAULT 0,
    "steps" text,
    "errorMessage" text,
    "metadata" text,
    "createdAt" datetime DEFAULT (datetime('now')),
    FOREIGN KEY ("executionId") REFERENCES "test_executions" ("executionId") ON DELETE CASCADE
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS "IDX_test_results_executionId" ON "test_results" ("executionId");
CREATE INDEX IF NOT EXISTS "IDX_test_results_scenarioName" ON "test_results" ("scenarioName");
CREATE INDEX IF NOT EXISTS "IDX_test_results_status" ON "test_results" ("status");
CREATE INDEX IF NOT EXISTS "IDX_test_results_createdAt" ON "test_results" ("createdAt"); 