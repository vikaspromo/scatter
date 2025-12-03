#!/usr/bin/env python3
"""
Backfill date_end for existing items using regex pattern matching.
No Claude API calls - just local pattern matching on content.
"""
from __future__ import annotations

import os
import re
from datetime import datetime
from pathlib import Path
from typing import Optional
from dateutil import parser as date_parser
from supabase import create_client, Client
from dotenv import load_dotenv

# Load .env file from project root
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Supabase configuration
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    raise Exception("SUPABASE_URL and SUPABASE_KEY environment variables must be set")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Patterns to detect date ranges in content
# These patterns look for common date range formats
DATE_RANGE_PATTERNS = [
    # "December 4 to December 7" or "December 4 through December 7"
    r'(\w+\s+\d{1,2})\s*(?:to|through|–|-)\s*(\w+\s+\d{1,2})(?:,?\s*\d{4})?',
    # "Dec 4 to Dec 7"
    r'(\w{3}\s+\d{1,2})\s*(?:to|through|–|-)\s*(\w{3}\s+\d{1,2})(?:,?\s*\d{4})?',
    # "December 4-7" (same month, short format)
    r'(\w+\s+\d{1,2})\s*[-–]\s*(\d{1,2})(?:,?\s*\d{4})?',
    # "12/4 to 12/7" or "12/4-12/7"
    r'(\d{1,2}/\d{1,2})\s*(?:to|through|–|-)\s*(\d{1,2}/\d{1,2})(?:/\d{2,4})?',
]


def parse_date(date_str: str, year: int = None) -> str | None:
    """Parse a date string and return YYYY-MM-DD format."""
    if year is None:
        year = datetime.now().year

    try:
        # Try to parse the date string
        parsed = date_parser.parse(date_str, fuzzy=True)

        # If no year was in the string, use provided year
        if parsed.year == datetime.now().year and str(datetime.now().year) not in date_str:
            parsed = parsed.replace(year=year)

        return parsed.strftime('%Y-%m-%d')
    except Exception:
        return None


def extract_end_date_from_content(content: str, start_date: str | None) -> str | None:
    """
    Extract end date from content if it contains a date range.
    Returns the end date in YYYY-MM-DD format, or None if not a range.
    """
    if not content:
        return None

    # Determine the year context from start_date
    year = None
    if start_date:
        try:
            year = int(start_date.split('-')[0])
        except:
            year = datetime.now().year
    else:
        year = datetime.now().year

    for pattern in DATE_RANGE_PATTERNS:
        match = re.search(pattern, content, re.IGNORECASE)
        if match:
            groups = match.groups()

            if len(groups) >= 2:
                start_str = groups[0]
                end_str = groups[1]

                # Handle "December 4-7" format where end is just a day number
                if end_str.isdigit():
                    # Extract month from start_str
                    start_parsed = parse_date(start_str, year)
                    if start_parsed:
                        # Construct end date with same month
                        month = start_parsed.split('-')[1]
                        end_date = f"{year}-{month}-{end_str.zfill(2)}"
                        return end_date
                else:
                    # Full date string for end
                    end_parsed = parse_date(end_str, year)
                    if end_parsed:
                        return end_parsed

    return None


def backfill_end_dates():
    """Find items with date ranges in content and populate date_end."""
    print("="*60)
    print("BACKFILL END DATES")
    print("="*60)

    # Fetch all items that have a date_start but no date_end
    result = supabase.table('items').select('id, content, date_start').is_('date_end', 'null').execute()

    items = result.data
    print(f"\nFound {len(items)} items without date_end\n")

    updated_count = 0

    for item in items:
        content = item.get('content', '')
        start_date = item.get('date_start')

        end_date = extract_end_date_from_content(content, start_date)

        if end_date:
            # Validate end_date is after start_date
            if start_date and end_date < start_date:
                print(f"  ⚠ Skipping {item['id'][:8]}... - end_date {end_date} is before start_date {start_date}")
                continue

            # Update the item
            supabase.table('items').update({'date_end': end_date}).eq('id', item['id']).execute()

            # Show preview of content
            content_preview = content[:80].replace('\n', ' ') + '...' if len(content) > 80 else content.replace('\n', ' ')
            print(f"✓ {item['id'][:8]}... | {start_date} → {end_date}")
            print(f"  \"{content_preview}\"")
            print()

            updated_count += 1

    print("="*60)
    print(f"Updated {updated_count} items with end dates")
    print("="*60)


if __name__ == '__main__':
    backfill_end_dates()
