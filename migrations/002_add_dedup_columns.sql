-- Migration: Add deduplication columns to items table
-- Purpose: Track which items are current vs superseded by newer versions

-- Add is_current column - only TRUE items show in mobile inbox
ALTER TABLE items ADD COLUMN is_current BOOLEAN DEFAULT TRUE;

-- Add superseded_by column - links old item to its replacement (audit trail)
ALTER TABLE items ADD COLUMN superseded_by UUID REFERENCES items(id);

-- Index for efficient queries on current items
CREATE INDEX idx_items_is_current ON items(is_current);

-- Update RLS policy to allow reading superseded_by and is_current
-- (Existing policies should already cover SELECT on all columns)
