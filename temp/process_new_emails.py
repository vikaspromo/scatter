"""
Process new emails using Claude to extract items.

This script:
1. Queries emails where privacy_check_passed IS NULL
2. Sends each email to Claude for privacy check + item extraction
3. Stores extracted items in the items table
4. Links attachments to items based on filename matching
5. Updates the email's privacy_check_passed status
"""

import json
import re
from pathlib import Path
from supabase import create_client
import anthropic

from config import SUPABASE_URL, SUPABASE_KEY, ANTHROPIC_API_KEY

# Initialize clients
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

# Load prompt template
PROMPT_PATH = Path(__file__).parent / 'prompts' / 'parse_email.txt'
PROMPT_TEMPLATE = PROMPT_PATH.read_text()


def get_unprocessed_emails():
    """Fetch emails that haven't been processed yet."""
    response = supabase.table('emails').select(
        'id, subject, from_address, date, body'
    ).is_('privacy_check_passed', 'null').execute()
    return response.data


def get_attachments_for_email(email_id: str):
    """Get attachment filenames for an email."""
    response = supabase.table('attachments').select(
        'id, filename'
    ).eq('email_id', email_id).execute()
    return response.data


def parse_email_with_claude(email: dict, attachments: list) -> dict:
    """Send email to Claude for privacy check and item extraction."""
    attachment_names = [a['filename'] for a in attachments] if attachments else []
    attachment_str = ', '.join(attachment_names) if attachment_names else 'None'

    prompt = PROMPT_TEMPLATE.format(
        subject=email.get('subject', ''),
        from_address=email.get('from_address', ''),
        date=email.get('date', ''),
        attachments=attachment_str,
        body=email.get('body', '')
    )

    message = claude.messages.create(
        model='claude-sonnet-4-5-20250929',
        max_tokens=4096,
        messages=[{'role': 'user', 'content': prompt}]
    )

    response_text = message.content[0].text

    # Extract JSON from response (handle markdown code blocks)
    json_match = re.search(r'```json\s*(.*?)\s*```', response_text, re.DOTALL)
    if json_match:
        json_str = json_match.group(1)
    else:
        # Try to find raw JSON object
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            json_str = json_match.group(0)
        else:
            json_str = response_text.strip()

    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        print(f"  DEBUG - JSON parse error: {e}")
        print(f"  DEBUG - First 500 chars of response: {response_text[:500]}")
        raise


def save_item(email_id: str, item: dict) -> str:
    """Save an extracted item to the database and return its ID."""
    data = {
        'email_id': email_id,
        'content': item['content'],
        'date': item.get('date')
    }

    response = supabase.table('items').insert(data).execute()
    return response.data[0]['id']


def link_attachments_to_item(email_id: str, item_id: str, attachment_filenames: list, all_attachments: list):
    """Link attachments to an item based on filename matching."""
    if not attachment_filenames:
        return

    for attachment in all_attachments:
        if attachment['filename'] in attachment_filenames:
            supabase.table('attachments').update(
                {'item_id': item_id}
            ).eq('id', attachment['id']).execute()


def update_email_status(email_id: str, passed: bool):
    """Update the email's privacy_check_passed status."""
    supabase.table('emails').update(
        {'privacy_check_passed': passed}
    ).eq('id', email_id).execute()


def clear_email_body(email_id: str):
    """Clear the email body for privacy-failed emails."""
    supabase.table('emails').update(
        {'body': None}
    ).eq('id', email_id).execute()


def process_email(email: dict):
    """Process a single email."""
    email_id = email['id']
    print(f"Processing email: {email.get('subject', 'No subject')}")

    # Get attachments for this email
    attachments = get_attachments_for_email(email_id)

    try:
        # Parse with Claude
        result = parse_email_with_claude(email, attachments)

        if result.get('privacy_check_passed'):
            # Save each extracted item
            items = result.get('items', [])
            print(f"  Privacy check passed. Extracted {len(items)} items.")

            for item in items:
                item_id = save_item(email_id, item)

                # Link attachments if specified
                attachment_filenames = item.get('attachment_filenames', [])
                if attachment_filenames:
                    link_attachments_to_item(email_id, item_id, attachment_filenames, attachments)
                    print(f"    Linked {len(attachment_filenames)} attachments to item")

            update_email_status(email_id, True)
        else:
            # Privacy check failed
            reason = result.get('reason', 'Unknown')
            print(f"  Privacy check failed: {reason}")
            update_email_status(email_id, False)
            clear_email_body(email_id)

    except json.JSONDecodeError as e:
        print(f"  Error parsing Claude response: {e}")
    except Exception as e:
        import traceback
        print(f"  Error processing email: {e}")
        traceback.print_exc()


def main():
    """Main entry point."""
    print("Fetching unprocessed emails...")
    emails = get_unprocessed_emails()

    if not emails:
        print("No unprocessed emails found.")
        return

    print(f"Found {len(emails)} unprocessed emails.\n")

    for email in emails:
        process_email(email)
        print()

    print("Done!")


if __name__ == '__main__':
    main()
