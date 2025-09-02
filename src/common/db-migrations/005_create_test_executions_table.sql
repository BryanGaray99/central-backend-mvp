-- Migration: 005_create_test_executions_table.sql
-- Description: Create test executions table
-- Created: 2024-01-01

CREATE TABLE IF NOT EXISTS "test_executions" (
    "id" varchar PRIMARY KEY,
    "projectId" varchar NOT NULL,
    "executionId" varchar NOT NULL UNIQUE,
    "entityName" varchar NOT NULL,
    "method" varchar,
    "testType" varchar DEFAULT 'all',
    "tags" text,
    "specificScenario" varchar,
    "status" varchar DEFAULT 'pending',
    "startedAt" datetime DEFAULT (datetime('now')),
    "completedAt" datetime,
    "totalScenarios" integer DEFAULT 0,
    "passedScenarios" integer DEFAULT 0,
    "failedScenarios" integer DEFAULT 0,
    "executionTime" integer DEFAULT 0,
    "errorMessage" text,
    "metadata" text,
    "testCaseId" varchar,
    "testSuiteId" varchar,
    "createdAt" datetime DEFAULT (datetime('now')),
    "updatedAt" datetime DEFAULT (datetime('now')),
    FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS "IDX_test_executions_projectId" ON "test_executions" ("projectId");
CREATE INDEX IF NOT EXISTS "IDX_test_executions_executionId" ON "test_executions" ("executionId");
CREATE INDEX IF NOT EXISTS "IDX_test_executions_entityName" ON "test_executions" ("entityName");
CREATE INDEX IF NOT EXISTS "IDX_test_executions_status" ON "test_executions" ("status");
CREATE INDEX IF NOT EXISTS "IDX_test_executions_startedAt" ON "test_executions" ("startedAt");
CREATE INDEX IF NOT EXISTS "IDX_test_executions_testCaseId" ON "test_executions" ("testCaseId");
CREATE INDEX IF NOT EXISTS "IDX_test_executions_testSuiteId" ON "test_executions" ("testSuiteId"); 