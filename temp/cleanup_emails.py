#!/usr/bin/env python3
"""
Delete emails from database that are not from vikassood@gmail.com
"""

import os
from supabase import create_client, Client

# Supabase configuration
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    raise Exception("SUPABASE_URL and SUPABASE_KEY environment variables must be set")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def cleanup_emails():
    """Delete emails not from vikassood@gmail.com"""

    # First, let's see what we have
    result = supabase.table('emails').select('id, from_address, subject').execute()
    emails = result.data

    print(f"Total emails in database: {len(emails)}\n")

    to_delete = []
    to_keep = []

    for email in emails:
        from_addr = email.get('from_address', '')
        if 'vikassood@gmail.com' in from_addr.lower():
            to_keep.append(email)
        else:
            to_delete.append(email)

    print(f"Emails to KEEP (from vikassood@gmail.com): {len(to_keep)}")
    print(f"Emails to DELETE: {len(to_delete)}\n")

    if to_delete:
        print("Deleting emails from:")
        for email in to_delete:
            print(f"  - {email['from_address'][:50]}: {email['subject'][:40]}...")

        # Delete the emails (cascade will delete related items and attachments)
        for email in to_delete:
            # First delete items associated with this email
            supabase.table('items').delete().eq('email_id', email['id']).execute()
            # Then delete attachments
            supabase.table('attachments').delete().eq('email_id', email['id']).execute()
            # Then delete the email
            supabase.table('emails').delete().eq('id', email['id']).execute()

        print(f"\n✓ Deleted {len(to_delete)} emails and their associated items")
    else:
        print("No emails to delete.")

    print(f"\nRemaining emails: {len(to_keep)}")

if __name__ == '__main__':
    cleanup_emails()
