// Item types matching the new simplified database schema

export interface InboxItem {
  id: string;
  email_id: string;
  content: string;        // Raw HTML/text from school email
  date: string | null;    // Date associated with this item (if any)
  email_date: string;     // Date of source email (for sorting)
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
