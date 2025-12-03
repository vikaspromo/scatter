-- Migration: Add external_urls column to items table
-- Purpose: Store extracted URLs for deduplication fingerprinting

-- Add external_urls as a text array
ALTER TABLE items ADD COLUMN external_urls TEXT[] DEFAULT '{}';

-- Index for efficient URL-based lookups (GIN index for array containment)
CREATE INDEX idx_items_external_urls ON items USING GIN (external_urls);
