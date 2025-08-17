-- Migration: Create Test Suites Table
-- Description: Stores test suites (test sets and test plans) for API testing MVP

CREATE TABLE IF NOT EXISTS "test_suites" (
  "id" varchar PRIMARY KEY,
  "suiteId" varchar UNIQUE NOT NULL,
  "projectId" varchar NOT NULL,
  "name" varchar NOT NULL,
  "description" text,
  "type" varchar(20) NOT NULL CHECK (type IN ('test_set', 'test_plan')),
  "section" varchar,
  "entity" varchar,
  "status" varchar(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'passed', 'failed', 'skipped')),
  
  -- Test cases structure (JSON array with nested structure)
  "testCases" json NOT NULL DEFAULT '[]',
  "testSets" json DEFAULT '[]', -- For test plans that include other test sets
  
  -- Execution properties
  "totalTestCases" integer DEFAULT 0,
  "passedTestCases" integer DEFAULT 0,
  "failedTestCases" integer DEFAULT 0,
  "skippedTestCases" integer DEFAULT 0,
  "executionTime" integer DEFAULT 0, -- in milliseconds
  "startedAt" datetime,
  "completedAt" datetime,
  "lastExecutedAt" datetime,
  
  -- Error tracking
  "errors" json DEFAULT '[]', -- Array of error objects
  "bugs" json DEFAULT '[]', -- Array of bug references
  "executionLogs" text,
  
  -- Metadata
  "tags" json DEFAULT '[]', -- Array of tags
  "environment" varchar(50) DEFAULT 'default',
  
  -- Timestamps
  "createdAt" datetime DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" datetime DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS "idx_test_suites_project_id" ON "test_suites" ("projectId");
CREATE INDEX IF NOT EXISTS "idx_test_suites_type" ON "test_suites" ("type");
CREATE INDEX IF NOT EXISTS "idx_test_suites_status" ON "test_suites" ("status");
CREATE INDEX IF NOT EXISTS "idx_test_suites_section" ON "test_suites" ("section");
CREATE INDEX IF NOT EXISTS "idx_test_suites_entity" ON "test_suites" ("entity");
CREATE INDEX IF NOT EXISTS "idx_test_suites_created_at" ON "test_suites" ("createdAt");
CREATE INDEX IF NOT EXISTS "idx_test_suites_last_executed" ON "test_suites" ("lastExecutedAt");
CREATE INDEX IF NOT EXISTS "idx_test_suites_suite_id" ON "test_suites" ("suiteId");
