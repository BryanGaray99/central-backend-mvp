-- Migration: 001_create_projects_table.sql
-- Description: Create projects table
-- Created: 2024-01-01

CREATE TABLE IF NOT EXISTS "projects" (
    "id" varchar PRIMARY KEY,
    "name" varchar NOT NULL UNIQUE,
    "displayName" varchar,
    "description" text,
    "baseUrl" varchar NOT NULL,
    "basePath" varchar DEFAULT '/v1/api',
    "tags" text,
    "status" varchar DEFAULT 'pending',
    "type" varchar DEFAULT 'playwright-bdd',
    "path" varchar,
    "assistant_id" varchar,
    "assistant_created_at" datetime,
    "metadata" json,
    "createdAt" datetime DEFAULT (datetime('now')),
    "updatedAt" datetime DEFAULT (datetime('now'))
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS "IDX_projects_name" ON "projects" ("name");
CREATE INDEX IF NOT EXISTS "IDX_projects_status" ON "projects" ("status");
CREATE INDEX IF NOT EXISTS "IDX_projects_assistant_id" ON "projects" ("assistant_id");
CREATE INDEX IF NOT EXISTS "IDX_projects_display_name" ON "projects" ("displayName");
CREATE INDEX IF NOT EXISTS "IDX_projects_base_path" ON "projects" ("basePath"); 