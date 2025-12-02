-- Run this in Supabase SQL Editor to create the items table

CREATE TABLE IF NOT EXISTS items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Categorization
    category TEXT NOT NULL CHECK (category IN ('school', 'class')),
    teacher_name TEXT,  -- NULL for school-wide items

    -- Item details
    item_type TEXT NOT NULL,  -- 'field_trip', 'homework', 'event', 'task', 'curriculum', 'reminder', 'volunteer', 'other'
    title TEXT NOT NULL,  -- Short title for the item
    description TEXT,  -- Full details

    -- Dates
    event_date DATE,  -- When the event/deadline occurs (NULL if ongoing)
    event_time TEXT,  -- Time of day if applicable

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    expired_reason TEXT,  -- Why it was expired: 'past_date', 'no_longer_mentioned', 'superseded'

    -- Source tracking
    source_email_id UUID REFERENCES emails(id),
    first_seen_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_teacher ON items(teacher_name);
CREATE INDEX idx_items_active ON items(is_active);
CREATE INDEX idx_items_event_date ON items(event_date);
CREATE INDEX idx_items_type ON items(item_type);

-- View for active items only
CREATE OR REPLACE VIEW active_items AS
SELECT * FROM items WHERE is_active = TRUE ORDER BY event_date ASC NULLS LAST;
