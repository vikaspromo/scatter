-- Email Parser Database Schema
-- Run this SQL in your Supabase SQL Editor to create the tables

-- Table to store email information
CREATE TABLE IF NOT EXISTS emails (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    gmail_id TEXT UNIQUE NOT NULL,
    subject TEXT,
    from_address TEXT,
    date TIMESTAMP WITH TIME ZONE,
    body TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table to store attachment metadata
CREATE TABLE IF NOT EXISTS attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_size BIGINT,
    mime_type TEXT,
    storage_path TEXT NOT NULL,
    storage_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_emails_gmail_id ON emails(gmail_id);
CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date DESC);
CREATE INDEX IF NOT EXISTS idx_attachments_email_id ON attachments(email_id);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your authentication needs)
-- This example allows all operations for authenticated users
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON emails;
CREATE POLICY "Allow all operations for authenticated users"
    ON emails FOR ALL
    USING (true);

DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON attachments;
CREATE POLICY "Allow all operations for authenticated users"
    ON attachments FOR ALL
    USING (true);
