import { createClient } from '@supabase/supabase-js';

// TODO: Move these to environment variables for production
// The anon key is safe to use client-side (it respects RLS policies)
const SUPABASE_URL = 'https://vbldlqbhhcoeobimeeab.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZibGRscWJoaGNvZW9iaW1lZWFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0NTUwNDMsImV4cCI6MjA3ODAzMTA0M30.UD7ezg_X1QaFCrhKsQVyEkllzvOQqqZY3oXb8QKyH6Q';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Types for database tables
export interface DbItem {
  id: string;
  email_id: string;
  content: string;
  date_start: string | null;
  date_end: string | null;
  created_at: string;
  is_current: boolean;
  superseded_by: string | null;
}

export interface DbEmail {
  id: string;
  subject: string;
  from_address: string;
  date: string;
  gmail_id: string;
}

export interface DbUserItem {
  id: string;
  user_id: string;
  item_id: string;
  status: 'inbox' | 'archived' | 'remind';
  remind_at: string | null;
  created_at: string;
  updated_at: string;
}

// Fetch items with email date for sorting (only current items not yet triaged by user)
export async function fetchInboxItems(userId: string): Promise<(DbItem & { email_date: string; from_address: string; subject: string })[]> {
  // First, get item IDs that user has already triaged
  const { data: triagedItems, error: triagedError } = await supabase
    .from('user_items')
    .select('item_id')
    .eq('user_id', userId)
    .in('status', ['archived', 'remind']);

  if (triagedError) {
    console.error('Error fetching triaged items:', triagedError);
    throw triagedError;
  }

  const triagedIds = (triagedItems || []).map(item => item.item_id);

  // Fetch all current items
  const { data, error } = await supabase
    .from('items')
    .select(`
      id,
      email_id,
      content,
      date_start,
      date_end,
      created_at,
      is_current,
      superseded_by,
      emails(date, from_address, subject)
    `)
    .eq('is_current', true);

  if (error) {
    console.error('Error fetching items:', error);
    throw error;
  }

  // Get today's date in YYYY-MM-DD format for comparison
  const today = new Date().toISOString().split('T')[0];

  // Flatten, filter out triaged items and expired items, and sort by email date (most recent first)
  const items = (data || [])
    .filter((item: any) => !triagedIds.includes(item.id))
    .filter((item: any) => !item.date_end || item.date_end >= today) // Exclude items with past end dates
    .map((item: any) => ({
      id: item.id,
      email_id: item.email_id,
      content: item.content,
      date_start: item.date_start,
      date_end: item.date_end,
      created_at: item.created_at,
      is_current: item.is_current,
      superseded_by: item.superseded_by,
      email_date: item.emails?.date || item.created_at,
      from_address: item.emails?.from_address || '',
      subject: item.emails?.subject || '',
    }));

  // Sort by email_date descending
  items.sort((a, b) => new Date(b.email_date).getTime() - new Date(a.email_date).getTime());

  return items;
}

// Fetch items that user has marked as 'remind'
export async function fetchRemindedItems(userId: string): Promise<(DbItem & { email_date: string; from_address: string; subject: string })[]> {
  // Get item IDs that user has marked as remind
  const { data: remindedUserItems, error: remindError } = await supabase
    .from('user_items')
    .select('item_id')
    .eq('user_id', userId)
    .eq('status', 'remind');

  if (remindError) {
    console.error('Error fetching reminded items:', remindError);
    throw remindError;
  }

  const remindedIds = (remindedUserItems || []).map(item => item.item_id);

  if (remindedIds.length === 0) {
    return [];
  }

  // Fetch the actual items
  const { data, error } = await supabase
    .from('items')
    .select(`
      id,
      email_id,
      content,
      date_start,
      date_end,
      created_at,
      is_current,
      superseded_by,
      emails(date, from_address, subject)
    `)
    .in('id', remindedIds);

  if (error) {
    console.error('Error fetching items:', error);
    throw error;
  }

  // Flatten and sort by date (soonest first for reminders)
  const items = (data || []).map((item: any) => ({
    id: item.id,
    email_id: item.email_id,
    content: item.content,
    date_start: item.date_start,
    date_end: item.date_end,
    created_at: item.created_at,
    is_current: item.is_current,
    superseded_by: item.superseded_by,
    email_date: item.emails?.date || item.created_at,
    from_address: item.emails?.from_address || '',
    subject: item.emails?.subject || '',
  }));

  // Sort by item date_start (soonest first), then by email date
  items.sort((a, b) => {
    if (a.date_start && b.date_start) {
      return new Date(a.date_start).getTime() - new Date(b.date_start).getTime();
    }
    if (a.date_start) return -1;
    if (b.date_start) return 1;
    return new Date(b.email_date).getTime() - new Date(a.email_date).getTime();
  });

  return items;
}

// Update user's item status (for triage actions)
export async function updateUserItemStatus(
  userId: string,
  itemId: string,
  status: 'inbox' | 'archived' | 'remind',
  remindAt?: string
) {
  const { data, error } = await supabase
    .from('user_items')
    .upsert({
      user_id: userId,
      item_id: itemId,
      status,
      remind_at: remindAt || null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,item_id',
    });

  if (error) {
    console.error('Error updating user item status:', error);
    throw error;
  }

  return data;
}
