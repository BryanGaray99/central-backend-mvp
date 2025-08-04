-- Migration: 003_create_test_cases_table.sql
-- Description: Create test cases table
-- Created: 2024-01-01

CREATE TABLE IF NOT EXISTS "test_cases" (
    "id" varchar PRIMARY KEY,
    "testCaseId" varchar NOT NULL UNIQUE,
    "projectId" varchar NOT NULL,
    "entityName" varchar NOT NULL,
    "section" varchar NOT NULL,
    "name" varchar NOT NULL,
    "description" text NOT NULL,
    "tags" text NOT NULL,
    "method" varchar NOT NULL,
    "testType" varchar DEFAULT 'positive',
    "scenario" text NOT NULL,
    "hooks" text,
    "examples" text,
    "status" varchar DEFAULT 'active',
    "lastRun" datetime,
    "lastRunStatus" varchar,
    "metadata" text,
    "createdAt" datetime DEFAULT (datetime('now')),
    "updatedAt" datetime DEFAULT (datetime('now')),
    FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS "IDX_test_cases_projectId" ON "test_cases" ("projectId");
CREATE INDEX IF NOT EXISTS "IDX_test_cases_entityName" ON "test_cases" ("entityName");
CREATE INDEX IF NOT EXISTS "IDX_test_cases_section" ON "test_cases" ("section");
CREATE INDEX IF NOT EXISTS "IDX_test_cases_status" ON "test_cases" ("status");
CREATE INDEX IF NOT EXISTS "IDX_test_cases_testCaseId" ON "test_cases" ("testCaseId"); 