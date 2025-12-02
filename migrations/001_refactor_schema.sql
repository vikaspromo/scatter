-- Scatter Schema Refactoring Migration
-- Run this in Supabase SQL Editor

-- ============================================
-- PHASE 1: Drop legacy tables
-- ============================================

DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS summaries CASCADE;
DROP TABLE IF EXISTS items CASCADE;

-- ============================================
-- PHASE 2: Modify emails table
-- ============================================

ALTER TABLE emails ADD COLUMN IF NOT EXISTS privacy_check_passed BOOLEAN;

-- ============================================
-- PHASE 3: Create new items table
-- ============================================

CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_items_email ON items(email_id);
CREATE INDEX idx_items_date ON items(date);

-- ============================================
-- PHASE 4: Create user_items table (per-user status)
-- ============================================

CREATE TABLE user_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'inbox',
  remind_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, item_id)
);

CREATE INDEX idx_user_items_user ON user_items(user_id);
CREATE INDEX idx_user_items_status ON user_items(user_id, status);
CREATE INDEX idx_user_items_remind ON user_items(remind_at) WHERE remind_at IS NOT NULL;

-- ============================================
-- PHASE 5: Modify attachments table
-- ============================================

ALTER TABLE attachments ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_attachments_item ON attachments(item_id);

-- ============================================
-- PHASE 6: Row Level Security (RLS) for user_items
-- ============================================

ALTER TABLE user_items ENABLE ROW LEVEL SECURITY;

-- Users can only see their own user_items
CREATE POLICY "Users can view own user_items" ON user_items
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own user_items
CREATE POLICY "Users can insert own user_items" ON user_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own user_items
CREATE POLICY "Users can update own user_items" ON user_items
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own user_items
CREATE POLICY "Users can delete own user_items" ON user_items
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- PHASE 7: RLS for items (read-only for authenticated users)
-- ============================================

ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read items
CREATE POLICY "Authenticated users can view items" ON items
  FOR SELECT USING (auth.role() = 'authenticated');
