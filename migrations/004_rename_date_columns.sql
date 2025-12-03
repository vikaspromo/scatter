-- Migration: Rename date to date_start and add date_end for multi-day events
-- Run this in Supabase SQL editor

-- Rename existing date column to date_start
ALTER TABLE items RENAME COLUMN date TO date_start;

-- Add date_end column for multi-day events
ALTER TABLE items ADD COLUMN date_end DATE;

-- Update index to use new column name (drop old, create new)
DROP INDEX IF EXISTS idx_items_date;
CREATE INDEX idx_items_date_start ON items(date_start);
CREATE INDEX idx_items_date_end ON items(date_end);
