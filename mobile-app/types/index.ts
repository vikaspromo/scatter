// Item types matching the new simplified database schema

export interface InboxItem {
  id: string;
  email_id: string;
  content: string;          // Raw HTML/text from school email
  date_start: string | null; // Start date associated with this item (if any)
  date_end: string | null;   // End date for multi-day events (if any)
  email_date: string;       // Date of source email (for sorting)
  from_address: string;     // Sender email/name from email headers
  subject: string;          // Email subject line
  created_at: string;
}

export type TriageDecision = 'done' | 'remind';

export interface UserItemStatus {
  user_id: string;
  item_id: string;
  status: 'inbox' | 'done' | 'remind';
  remind_at: string | null;
}

export interface Student {
  id: string;
  name: string;
  grade: string;
  teacher: string | null;
}
