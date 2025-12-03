#!/usr/bin/env python3
"""
One-time script to:
1. Backfill external_urls for existing items (extract from content)
2. Run dedup using URL matching + text similarity

Run after applying migration 003_add_external_urls.sql
"""

import os
import re
from pathlib import Path
from difflib import SequenceMatcher
from dotenv import load_dotenv
from supabase import create_client, Client

# Load .env file from project root
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Supabase configuration
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    raise Exception("SUPABASE_URL and SUPABASE_KEY environment variables must be set")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

SIMILARITY_THRESHOLD = 0.85

# URLs to exclude from fingerprinting
EXCLUDED_URL_PATTERNS = [
    'supabase.co',
    'google.com/url',
    'unsubscribe',
    'mailto:',
]


def extract_urls(content: str) -> list[str]:
    """Extract actionable URLs from content."""
    if not content:
        return []

    url_pattern = r'https?://[^\s<>"\')(\][]+'
    urls = re.findall(url_pattern, content)

    # Clean up URLs (remove trailing punctuation)
    urls = [url.rstrip('.,;:!?*') for url in urls]

    # Filter out excluded patterns
    filtered = []
    for url in urls:
        if not any(pattern in url.lower() for pattern in EXCLUDED_URL_PATTERNS):
            filtered.append(url)

    return list(set(filtered))  # Dedupe


def similarity(a: str, b: str) -> float:
    """Calculate text similarity ratio."""
    if not a or not b:
        return 0.0
    a_norm = " ".join(a.split())
    b_norm = " ".join(b.split())
    return SequenceMatcher(None, a_norm, b_norm).ratio()


def supersede_item(old_item_id: str, new_item_id: str):
    """Mark old item as superseded and migrate user statuses."""
    supabase.table('items').update({
        'is_current': False,
        'superseded_by': new_item_id
    }).eq('id', old_item_id).execute()

    # Migrate user_items
    old_user_items = supabase.table('user_items').select(
        'user_id, status, remind_at'
    ).eq('item_id', old_item_id).execute()

    for user_item in old_user_items.data:
        try:
            supabase.table('user_items').insert({
                'user_id': user_item['user_id'],
                'item_id': new_item_id,
                'status': user_item['status'],
                'remind_at': user_item['remind_at']
            }).execute()
        except Exception as e:
            if 'duplicate' in str(e).lower() or '23505' in str(e):
                pass
            else:
                print(f"  Warning: Could not migrate user_item: {e}")


def main():
    print("=" * 60)
    print("BACKFILL URLs AND RUN DEDUP")
    print("=" * 60)

    # Step 1: Backfill URLs for all items
    print("\n--- Step 1: Backfilling URLs ---\n")

    all_items = supabase.table('items').select('id, content, external_urls').execute()
    updated = 0

    for item in all_items.data:
        urls = extract_urls(item['content'])
        existing_urls = item.get('external_urls') or []

        if urls and urls != existing_urls:
            supabase.table('items').update({
                'external_urls': urls
            }).eq('id', item['id']).execute()
            updated += 1

    print(f"Updated {updated} items with extracted URLs\n")

    # Step 2: Find duplicates among current items using URL matching
    print("--- Step 2: Finding duplicates with URL matching ---\n")

    current_items = supabase.table('items').select(
        'id, content, date, external_urls, created_at'
    ).eq('is_current', True).order('created_at', desc=False).execute()

    items = current_items.data
    print(f"Found {len(items)} current items\n")

    # Build URL index
    url_to_items = {}
    for item in items:
        for url in (item.get('external_urls') or []):
            if url not in url_to_items:
                url_to_items[url] = []
            url_to_items[url].append(item)

    # Find groups by shared URLs (same date only)
    processed = set()
    duplicate_groups = []

    for url, url_items in url_to_items.items():
        if len(url_items) < 2:
            continue

        # Group by date
        by_date = {}
        for item in url_items:
            if item['id'] in processed:
                continue
            date = item.get('date')
            if date not in by_date:
                by_date[date] = []
            by_date[date].append(item)

        for date, group in by_date.items():
            if len(group) > 1:
                # Mark as processed
                for item in group:
                    processed.add(item['id'])
                duplicate_groups.append({
                    'reason': f'shared URL: {url[:50]}...' if len(url) > 50 else f'shared URL: {url}',
                    'items': group
                })

    # Also check text similarity for items not yet grouped
    print(f"Found {len(duplicate_groups)} URL-based duplicate groups")
    print("Checking remaining items for text similarity...\n")

    remaining = [i for i in items if i['id'] not in processed]
    for i, item_a in enumerate(remaining):
        if item_a['id'] in processed:
            continue

        group = [item_a]
        date_a = item_a.get('date')
        content_a = " ".join((item_a['content'] or '').split())

        for item_b in remaining[i+1:]:
            if item_b['id'] in processed:
                continue
            if item_b.get('date') != date_a:
                continue

            content_b = " ".join((item_b['content'] or '').split())
            if similarity(content_a, content_b) >= SIMILARITY_THRESHOLD:
                group.append(item_b)
                processed.add(item_b['id'])

        if len(group) > 1:
            processed.add(item_a['id'])
            duplicate_groups.append({
                'reason': 'text similarity ≥85%',
                'items': group
            })

    print(f"Total duplicate groups: {len(duplicate_groups)}\n")

    # Process groups
    total_superseded = 0
    for group_info in duplicate_groups:
        group = group_info['items']
        reason = group_info['reason']

        # Sort by created_at descending - newest first
        group.sort(key=lambda x: x['created_at'], reverse=True)

        newest = group[0]
        older_items = group[1:]

        print(f"Group ({reason}):")
        print(f"  Keeping: {newest['id'][:8]}... - {(newest['content'] or '')[:50]}...")

        for old_item in older_items:
            print(f"  Superseding: {old_item['id'][:8]}... - {(old_item['content'] or '')[:50]}...")
            supersede_item(old_item['id'], newest['id'])
            total_superseded += 1

        print()

    print("=" * 60)
    print(f"COMPLETED: Superseded {total_superseded} additional items")
    print("=" * 60)

    # Final counts
    current = supabase.table('items').select('id', count='exact').eq('is_current', True).execute()
    superseded = supabase.table('items').select('id', count='exact').eq('is_current', False).execute()
    print(f"\nFinal counts:")
    print(f"  Current items: {current.count}")
    print(f"  Superseded items: {superseded.count}")


if __name__ == '__main__':
    main()
