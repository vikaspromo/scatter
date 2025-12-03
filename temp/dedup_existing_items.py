#!/usr/bin/env python3
"""
One-time script to deduplicate existing items in the database.

This script:
1. Fetches all items where is_current = TRUE
2. Groups similar items (≥85% text similarity)
3. Marks older items as superseded by newer ones
4. Migrates user_items from old items to new items

Run after applying migration 002_add_dedup_columns.sql
"""

import os
import sys
from pathlib import Path
from difflib import SequenceMatcher
from collections import defaultdict
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


def similarity(a: str, b: str) -> float:
    """Calculate text similarity ratio between two strings."""
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def normalize_content(content: str) -> str:
    """Normalize content for comparison by stripping whitespace."""
    if not content:
        return ""
    return " ".join(content.split())


def fetch_current_items():
    """Fetch all items where is_current = TRUE."""
    result = supabase.table('items').select(
        'id, content, date, created_at, email_id'
    ).eq('is_current', True).order('created_at', desc=False).execute()
    return result.data


def supersede_item(old_item_id: str, new_item_id: str):
    """Mark old item as superseded and migrate user statuses."""
    # Update old item
    supabase.table('items').update({
        'is_current': False,
        'superseded_by': new_item_id
    }).eq('id', old_item_id).execute()

    # Migrate user_items from old to new
    # First, get user_items for old item
    old_user_items = supabase.table('user_items').select(
        'user_id, status, remind_at'
    ).eq('item_id', old_item_id).execute()

    for user_item in old_user_items.data:
        # Try to insert for new item (ignore if already exists)
        try:
            supabase.table('user_items').insert({
                'user_id': user_item['user_id'],
                'item_id': new_item_id,
                'status': user_item['status'],
                'remind_at': user_item['remind_at']
            }).execute()
        except Exception as e:
            if 'duplicate' in str(e).lower() or '23505' in str(e):
                # User already has status for new item, skip
                pass
            else:
                print(f"  Warning: Could not migrate user_item: {e}")


def find_duplicates(items):
    """Find groups of similar items with matching dates."""
    # Track which items have been grouped
    processed = set()
    duplicate_groups = []

    for i, item_a in enumerate(items):
        if item_a['id'] in processed:
            continue

        group = [item_a]
        content_a = normalize_content(item_a['content'])
        date_a = item_a.get('date')

        for j, item_b in enumerate(items[i+1:], start=i+1):
            if item_b['id'] in processed:
                continue

            # Dates must match (both null or both equal) to be duplicates
            date_b = item_b.get('date')
            if date_a != date_b:
                continue

            content_b = normalize_content(item_b['content'])
            sim = similarity(content_a, content_b)

            if sim >= SIMILARITY_THRESHOLD:
                group.append(item_b)
                processed.add(item_b['id'])

        if len(group) > 1:
            processed.add(item_a['id'])
            duplicate_groups.append(group)

    return duplicate_groups


def main():
    print("=" * 60)
    print("DEDUPLICATING EXISTING ITEMS")
    print("=" * 60)
    print(f"\nSimilarity threshold: {SIMILARITY_THRESHOLD * 100}%\n")

    # Fetch all current items
    items = fetch_current_items()
    print(f"Found {len(items)} current items\n")

    if not items:
        print("No items to process.")
        return

    # Find duplicate groups
    duplicate_groups = find_duplicates(items)
    print(f"Found {len(duplicate_groups)} groups of duplicates\n")

    if not duplicate_groups:
        print("No duplicates found!")
        return

    # Process each group
    total_superseded = 0
    for group in duplicate_groups:
        # Sort by created_at descending - newest first
        group.sort(key=lambda x: x['created_at'], reverse=True)

        newest = group[0]
        older_items = group[1:]

        print(f"Group with {len(group)} items:")
        print(f"  Newest (keeping): {newest['id'][:8]}... - {newest['content'][:50]}...")

        for old_item in older_items:
            print(f"  Superseding: {old_item['id'][:8]}... - {old_item['content'][:50]}...")
            supersede_item(old_item['id'], newest['id'])
            total_superseded += 1

        print()

    print("=" * 60)
    print(f"COMPLETED: Superseded {total_superseded} items")
    print("=" * 60)


if __name__ == '__main__':
    main()
