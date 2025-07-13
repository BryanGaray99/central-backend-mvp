-- Migration: 002_create_endpoints_table.sql
-- Description: Create endpoints table
-- Created: 2024-01-01

CREATE TABLE IF NOT EXISTS "endpoints" (
    "id" varchar PRIMARY KEY,
    "name" varchar NOT NULL,
    "projectId" varchar NOT NULL,
    "section" varchar NOT NULL,
    "entityName" varchar NOT NULL,
    "path" varchar NOT NULL,
    "methods" text NOT NULL,
    "pathParameters" text,
    "description" text,
    "analysisResults" text,
    "generatedArtifacts" text,
    "status" varchar DEFAULT 'pending',
    "errorMessage" text,
    "createdAt" datetime DEFAULT (datetime('now')),
    "updatedAt" datetime DEFAULT (datetime('now')),
    FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS "IDX_endpoints_projectId" ON "endpoints" ("projectId");
CREATE INDEX IF NOT EXISTS "IDX_endpoints_entityName" ON "endpoints" ("entityName");
CREATE INDEX IF NOT EXISTS "IDX_endpoints_section" ON "endpoints" ("section");
CREATE INDEX IF NOT EXISTS "IDX_endpoints_status" ON "endpoints" ("status"); 