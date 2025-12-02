-- AI Processor Database Schema
-- Run this SQL in your Supabase SQL Editor to create the summaries table

-- Table to store AI-generated summaries
CREATE TABLE IF NOT EXISTS summaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('school', 'class')),
    teacher_name TEXT,

    -- Summary content
    bullet_points TEXT[],  -- Array of bullet point strings
    summary_text TEXT,     -- Brief narrative summary

    -- Metadata
    source_email_ids UUID[],  -- Which emails contributed to this summary
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_summaries_category ON summaries(category);
CREATE INDEX IF NOT EXISTS idx_summaries_teacher ON summaries(teacher_name);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;

-- Create policies (allows all operations for now - adjust based on your needs)
DROP POLICY IF EXISTS "Allow all operations" ON summaries;
CREATE POLICY "Allow all operations"
    ON summaries FOR ALL
    USING (true);
