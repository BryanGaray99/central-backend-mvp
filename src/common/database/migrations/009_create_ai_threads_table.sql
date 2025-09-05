-- Migration: 009_create_ai_threads_table.sql
-- Description: Create AI threads table
-- Created: 2024-01-01

CREATE TABLE IF NOT EXISTS "ai_threads" (
    "id" integer PRIMARY KEY AUTOINCREMENT,
    "project_id" varchar NOT NULL,
    "thread_id" varchar NOT NULL UNIQUE,
    "assistant_id" varchar NOT NULL,
    "status" varchar DEFAULT 'active',
    "message_count" integer DEFAULT 0,
    "max_messages" integer DEFAULT 1000,
    "last_used_at" datetime DEFAULT (datetime('now')),
    "created_at" datetime DEFAULT (datetime('now')),
    FOREIGN KEY ("project_id") REFERENCES "projects"("id"),
    FOREIGN KEY ("assistant_id") REFERENCES "ai_assistants"("assistant_id")
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS "IDX_ai_threads_project_id" ON "ai_threads" ("project_id");
CREATE INDEX IF NOT EXISTS "IDX_ai_threads_thread_id" ON "ai_threads" ("thread_id");
CREATE INDEX IF NOT EXISTS "IDX_ai_threads_assistant_id" ON "ai_threads" ("assistant_id");
CREATE INDEX IF NOT EXISTS "IDX_ai_threads_status" ON "ai_threads" ("status"); 