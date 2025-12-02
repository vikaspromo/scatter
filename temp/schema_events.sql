-- Run this in Supabase SQL Editor to create the events table
--
-- event_type values: Field Trip, No School, Meeting, Celebration, Holiday Event,
--   Conference, Picture Day, Showcase, Book Fair, Social, Community, Open House,
--   Principal, Reminder, Event
--
-- grade values: ECE, K, 1st, 2nd, 3rd, 4th, 5th, All, or combinations like ECE-1st, 2nd-5th

CREATE TABLE IF NOT EXISTS events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Event details
    title TEXT NOT NULL,
    event_type TEXT NOT NULL,
    grade TEXT NOT NULL,
    teacher TEXT,
    event_date DATE,  -- The date of the event (NULL if ongoing/TBD)
    end_date DATE,  -- For multi-day events (e.g., Nov 26-28 for Thanksgiving)
    event_time TEXT,  -- Time of day (e.g., '9:30 AM', '2:00-2:30 PM')
    location TEXT,  -- Where the event takes place
    description TEXT,  -- Full description in school's voice
    link TEXT,  -- URL if provided (registration, more info, etc.)
    is_school_closed BOOLEAN DEFAULT FALSE,  -- TRUE for No School days

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    expired_reason TEXT,  -- 'past_date', etc.

    -- Source tracking
    source_email_id UUID REFERENCES emails(id),
    source_email_date TIMESTAMP WITH TIME ZONE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_grade ON events(grade);
CREATE INDEX idx_events_teacher ON events(teacher);
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_active ON events(is_active);
CREATE INDEX idx_events_school_closed ON events(is_school_closed);

-- View for active events only (sorted by date)
CREATE OR REPLACE VIEW active_events AS
SELECT * FROM events
WHERE is_active = TRUE
ORDER BY event_date ASC NULLS LAST;

-- View for upcoming events (future dates only)
CREATE OR REPLACE VIEW upcoming_events AS
SELECT * FROM events
WHERE is_active = TRUE
  AND (event_date >= CURRENT_DATE OR event_date IS NULL)
ORDER BY event_date ASC NULLS LAST;

-- View for No School days
CREATE OR REPLACE VIEW no_school_days AS
SELECT * FROM events
WHERE is_school_closed = TRUE
  AND is_active = TRUE
ORDER BY event_date ASC;
