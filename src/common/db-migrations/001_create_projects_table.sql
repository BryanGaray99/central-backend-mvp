-- Migration: 001_create_projects_table.sql
-- Description: Create projects table
-- Created: 2024-01-01

CREATE TABLE IF NOT EXISTS "projects" (
    "id" varchar PRIMARY KEY,
    "name" varchar NOT NULL UNIQUE,
    "displayName" varchar,
    "baseUrl" varchar NOT NULL,
    "basePath" varchar DEFAULT '/v1/api',
    "status" varchar DEFAULT 'pending',
    "type" varchar DEFAULT 'playwright-bdd',
    "path" varchar,
    "metadata" text,
    "createdAt" datetime DEFAULT (datetime('now')),
    "updatedAt" datetime DEFAULT (datetime('now'))
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS "IDX_projects_name" ON "projects" ("name");
CREATE INDEX IF NOT EXISTS "IDX_projects_status" ON "projects" ("status"); 