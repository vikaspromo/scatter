-- Run this in Supabase SQL Editor to create the tasks table
-- This replaces the items table for task-specific data

-- Drop the old items table (if you want to clean up)
-- DROP TABLE IF EXISTS items CASCADE;

CREATE TABLE IF NOT EXISTS tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Task details
    title TEXT NOT NULL,
    grade TEXT NOT NULL,  -- 'ECE', 'K', '1st', '2nd', '3rd', '4th', '5th', 'All Grades', or combinations
    teacher TEXT,  -- NULL for school-wide tasks
    due_date TEXT,  -- 'YYYY-MM-DD', 'Ongoing', 'ASAP', 'One-time'
    action TEXT NOT NULL,  -- Full description in school's voice
    link TEXT,  -- URL if provided
    is_required BOOLEAN DEFAULT TRUE,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    expired_reason TEXT,  -- 'past_date', 'completed', etc.

    -- Source tracking
    source_email_id UUID REFERENCES emails(id),
    source_email_date TIMESTAMP WITH TIME ZONE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_tasks_grade ON tasks(grade);
CREATE INDEX idx_tasks_teacher ON tasks(teacher);
CREATE INDEX idx_tasks_active ON tasks(is_active);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_required ON tasks(is_required);

-- View for active tasks only
CREATE OR REPLACE VIEW active_tasks AS
SELECT * FROM tasks
WHERE is_active = TRUE
ORDER BY
    CASE
        WHEN due_date ~ '^\d{4}-\d{2}-\d{2}$' THEN due_date::date
        ELSE '9999-12-31'::date
    END ASC,
    CASE due_date
        WHEN 'ASAP' THEN 1
        WHEN 'Ongoing' THEN 2
        WHEN 'One-time' THEN 3
        ELSE 0
    END ASC;
