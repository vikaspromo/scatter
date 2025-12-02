#!/usr/bin/env python3
"""Check what's in the summaries table."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Check summaries
print("📊 SUMMARIES TABLE:")
print("="*60)
result = supabase.table('summaries').select('*').execute()

if not result.data:
    print("No summaries found.")
else:
    for s in result.data:
        print(f"\n📌 {s['category'].upper()}" + (f" - {s['teacher_name']}" if s['teacher_name'] else ""))
        print(f"   Source emails: {len(s['source_email_ids']) if s['source_email_ids'] else 0}")
        print(f"   Bullet points: {len(s['bullet_points']) if s['bullet_points'] else 0}")
        print(f"   Created: {s['created_at']}")

print("\n" + "="*60)
print(f"Total summaries: {len(result.data)}")

# Check total emails
emails = supabase.table('emails').select('id').execute()
print(f"Total emails in database: {len(emails.data)}")
print("="*60)
