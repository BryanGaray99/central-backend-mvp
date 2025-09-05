-- Migration: Create Bugs Table
-- Description: Stores bug tracking for API testing MVP

CREATE TABLE IF NOT EXISTS "bugs" (
  "id" varchar PRIMARY KEY,
  "bugId" varchar UNIQUE NOT NULL,
  "projectId" varchar NOT NULL,
  "testCaseId" varchar,
  "testSuiteId" varchar,
  "executionId" varchar,
  
  -- Bug identification
  "title" varchar NOT NULL,
  "description" text NOT NULL,
  "scenarioName" varchar,
  "testCaseName" varchar,
  
  -- Bug classification
  "type" varchar(20) NOT NULL CHECK (type IN ('system_bug', 'framework_error', 'test_failure', 'environment_issue')),
  "severity" varchar(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  "priority" varchar(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  
  -- Status tracking
  "status" varchar(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  
  -- Error details
  "errorMessage" text,
  "errorType" varchar(100),
  "errorStack" text,
  "errorCode" varchar(50),
  
  -- Execution context
  "section" varchar,
  "entity" varchar,
  "method" varchar,
  "endpoint" varchar,
  "requestData" json,
  "responseData" json,
  "executionTime" integer, -- in milliseconds
  "executionDate" datetime,
  
  -- Logs
  "executionLogs" text,
  "consoleLogs" text,
  
  -- Environment info
  "environment" varchar(50) DEFAULT 'default',
  
  -- Timestamps
  "reportedAt" datetime DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" datetime,
  "createdAt" datetime DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" datetime DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("testCaseId") REFERENCES "test_cases" ("id") ON DELETE SET NULL,
  FOREIGN KEY ("testSuiteId") REFERENCES "test_suites" ("id") ON DELETE SET NULL
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS "idx_bugs_project_id" ON "bugs" ("projectId");
CREATE INDEX IF NOT EXISTS "idx_bugs_test_case_id" ON "bugs" ("testCaseId");
CREATE INDEX IF NOT EXISTS "idx_bugs_test_suite_id" ON "bugs" ("testSuiteId");
CREATE INDEX IF NOT EXISTS "idx_bugs_execution_id" ON "bugs" ("executionId");
CREATE INDEX IF NOT EXISTS "idx_bugs_type" ON "bugs" ("type");
CREATE INDEX IF NOT EXISTS "idx_bugs_status" ON "bugs" ("status");
CREATE INDEX IF NOT EXISTS "idx_bugs_severity" ON "bugs" ("severity");
CREATE INDEX IF NOT EXISTS "idx_bugs_priority" ON "bugs" ("priority");
CREATE INDEX IF NOT EXISTS "idx_bugs_section" ON "bugs" ("section");
CREATE INDEX IF NOT EXISTS "idx_bugs_entity" ON "bugs" ("entity");
CREATE INDEX IF NOT EXISTS "idx_bugs_reported_at" ON "bugs" ("reportedAt");
CREATE INDEX IF NOT EXISTS "idx_bugs_execution_date" ON "bugs" ("executionDate");
CREATE INDEX IF NOT EXISTS "idx_bugs_bug_id" ON "bugs" ("bugId");
