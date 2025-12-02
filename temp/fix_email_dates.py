#!/usr/bin/env python3
"""
Fix email dates by extracting the original date from forwarded email bodies.
Forwarded emails contain headers like "Date: Mon, Oct 14, 2025 at 6:00 PM" in the body.
"""

import os
import re
from datetime import datetime
from dateutil import parser as date_parser
from supabase import create_client, Client

# Supabase configuration
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    raise Exception("SUPABASE_URL and SUPABASE_KEY environment variables must be set")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def extract_original_date(body: str):
    """Extract the original email date from a forwarded email body."""
    if not body:
        return None

    # Common patterns for forwarded email date headers
    patterns = [
        # "Date: Mon, Oct 14, 2025 at 6:00 PM"
        r'Date:\s*([A-Za-z]{3},\s+[A-Za-z]{3}\s+\d{1,2},\s+\d{4}\s+at\s+\d{1,2}:\d{2}\s*[AP]M)',
        # "Date: Mon, 14 Oct 2025 18:00:00"
        r'Date:\s*([A-Za-z]{3},\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s+\d{1,2}:\d{2}:\d{2})',
        # "Date: October 14, 2025 at 6:00 PM"
        r'Date:\s*([A-Za-z]+\s+\d{1,2},\s+\d{4}\s+at\s+\d{1,2}:\d{2}\s*[AP]M)',
        # "Date: 2025-10-14"
        r'Date:\s*(\d{4}-\d{2}-\d{2})',
        # "---------- Forwarded message ---------\nFrom: ...\nDate: ..."
        r'-+\s*Forwarded message\s*-+.*?Date:\s*([^\n<]+)',
    ]

    for pattern in patterns:
        match = re.search(pattern, body, re.IGNORECASE | re.DOTALL)
        if match:
            date_str = match.group(1).strip()
            try:
                # Parse the date string
                parsed_date = date_parser.parse(date_str, fuzzy=True)
                return parsed_date.isoformat()
            except Exception as e:
                print(f"  Could not parse date '{date_str}': {e}")
                continue

    return None


def fix_all_email_dates():
    """Update all emails with the correct original date from forwarded content."""
    print("Fetching all emails...\n")

    # Get all emails
    result = supabase.table('emails').select('id, subject, body, date').execute()
    emails = result.data

    print(f"Found {len(emails)} emails to process\n")

    updated_count = 0
    for email in emails:
        email_id = email['id']
        subject = email['subject']
        body = email['body']
        current_date = email['date']

        print(f"Processing: {subject[:50]}...")

        # Extract original date from body
        original_date = extract_original_date(body)

        if original_date:
            print(f"  Current date: {current_date}")
            print(f"  Original date: {original_date}")

            # Update the email with the correct date
            supabase.table('emails').update({
                'date': original_date
            }).eq('id', email_id).execute()

            print(f"  ✓ Updated!")
            updated_count += 1
        else:
            print(f"  Could not extract original date, keeping: {current_date}")

        print()

    print(f"\n{'='*60}")
    print(f"Updated {updated_count} of {len(emails)} emails")
    print(f"{'='*60}")


if __name__ == '__main__':
    fix_all_email_dates()
