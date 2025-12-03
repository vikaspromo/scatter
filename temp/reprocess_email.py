#!/usr/bin/env python3
"""Re-process a single email through Claude and save items to database."""
from __future__ import annotations

import os
import re
import json
import sys
from pathlib import Path
from difflib import SequenceMatcher
from supabase import create_client
import anthropic
from dotenv import load_dotenv

# Load .env
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

supabase = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_KEY'])
claude = anthropic.Anthropic(api_key=os.environ['ANTHROPIC_API_KEY'])

# Load prompt template
PROMPT_PATH = Path(__file__).parent.parent / 'backend' / 'prompts' / 'parse_email.txt'
PROMPT_TEMPLATE = PROMPT_PATH.read_text()

SIMILARITY_THRESHOLD = 0.85


def text_similarity(a: str, b: str) -> float:
    """Calculate text similarity ratio between two strings."""
    if not a or not b:
        return 0.0
    a_norm = " ".join(a.split())
    b_norm = " ".join(b.split())
    return SequenceMatcher(None, a_norm, b_norm).ratio()


def find_similar_item(new_content: str, new_date_start: str | None, new_urls: list[str] = None):
    """Find an existing current item with similar content."""
    if new_urls is None:
        new_urls = []

    result = supabase.table('items').select('id, content, date_start, external_urls').eq('is_current', True).execute()

    for existing in result.data:
        existing_date = existing.get('date_start')
        existing_urls = existing.get('external_urls') or []

        # Check for shared URLs first
        shared_urls = set(new_urls) & set(existing_urls)
        if shared_urls and new_date_start == existing_date:
            return existing['id'], 1.0

        # Fall back to text similarity
        if new_date_start != existing_date:
            continue

        sim = text_similarity(new_content, existing['content'])
        if sim >= SIMILARITY_THRESHOLD:
            return existing['id'], sim

    return None, 0.0


def supersede_item(old_item_id: str, new_item_id: str):
    """Mark old item as superseded."""
    supabase.table('items').update({
        'is_current': False,
        'superseded_by': new_item_id
    }).eq('id', old_item_id).execute()

    # Migrate user_items
    old_user_items = supabase.table('user_items').select('user_id, status, remind_at').eq('item_id', old_item_id).execute()
    for user_item in old_user_items.data:
        try:
            supabase.table('user_items').insert({
                'user_id': user_item['user_id'],
                'item_id': new_item_id,
                'status': user_item['status'],
                'remind_at': user_item['remind_at']
            }).execute()
        except Exception:
            pass


def save_item(email_id, item):
    """Save an extracted item to the database."""
    new_content = item['content']
    new_date_start = item.get('date_start')
    new_date_end = item.get('date_end')
    new_urls = item.get('external_urls', [])

    similar_id, sim_score = find_similar_item(new_content, new_date_start, new_urls)

    data = {
        'email_id': email_id,
        'content': new_content,
        'date_start': new_date_start,
        'date_end': new_date_end,
        'external_urls': new_urls,
        'is_current': True
    }

    response = supabase.table('items').insert(data).execute()
    new_item_id = response.data[0]['id']

    if similar_id:
        supersede_item(similar_id, new_item_id)
        print(f"    ↳ Superseded existing item ({sim_score*100:.0f}% similar)")

    return new_item_id


# Main script
email_id = sys.argv[1] if len(sys.argv) > 1 else 'b8d10426-ecce-49cc-b9f0-9b73dbb982fe'
result = supabase.table('emails').select('*').eq('id', email_id).single().execute()
email = result.data

print('='*60)
print(f"Subject: {email['subject']}")
print(f"From: {email['from_address']}")
print(f"Date: {email['date']}")
print('='*60)

# Get attachments
attachments_result = supabase.table('attachments').select('id, filename').eq('email_id', email_id).execute()
attachment_records = attachments_result.data
attachment_names = [a['filename'] for a in attachment_records]
attachment_str = ', '.join(attachment_names) if attachment_names else 'None'

# Build prompt
prompt = PROMPT_TEMPLATE.format(
    subject=email['subject'],
    from_address=email['from_address'],
    date=email['date'],
    attachments=attachment_str,
    body=email['body']
)

print('\nCalling Claude...')
message = claude.messages.create(
    model='claude-sonnet-4-5-20250929',
    max_tokens=4096,
    messages=[{'role': 'user', 'content': prompt}]
)

response_text = message.content[0].text

# Extract JSON from response
json_match = re.search(r'```json\s*(.*?)\s*```', response_text, re.DOTALL)
if json_match:
    json_str = json_match.group(1)
else:
    json_match = re.search(r'\{[\s\S]*\}', response_text)
    json_str = json_match.group(0) if json_match else response_text.strip()

parsed = json.loads(json_str)

if not parsed.get('privacy_check_passed'):
    print(f"\n✗ Privacy check failed: {parsed.get('reason')}")
    sys.exit(1)

items = parsed.get('items', [])
print(f"\n✓ Privacy check passed - extracting {len(items)} items...")

for i, item in enumerate(items, 1):
    content_preview = item['content'][:60].replace('\n', ' ')
    date_info = f"{item.get('date_start')} to {item.get('date_end')}" if item.get('date_start') else "no date"
    print(f"\n  {i}. {content_preview}...")
    print(f"     Dates: {date_info}")

    item_id = save_item(email_id, item)
    print(f"     ✓ Saved item {item_id[:8]}...")

    # Link attachments if specified
    attachment_filenames = item.get('attachment_filenames', [])
    if attachment_filenames:
        for attachment in attachment_records:
            if attachment['filename'] in attachment_filenames:
                supabase.table('attachments').update({'item_id': item_id}).eq('id', attachment['id']).execute()
        print(f"     Linked {len(attachment_filenames)} attachment(s)")

print(f"\n{'='*60}")
print(f"✓ Saved {len(items)} items from email")
print('='*60)
