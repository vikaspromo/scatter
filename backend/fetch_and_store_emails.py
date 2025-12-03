#!/usr/bin/env python3
"""
Fetch emails from Gmail with attachments and store in Supabase.
Privacy check happens BEFORE storing - only emails that pass are stored with body.
"""

import os
import sys
import json
import base64
import re
from datetime import datetime
from pathlib import Path
from difflib import SequenceMatcher
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from supabase import create_client, Client
import anthropic
from dotenv import load_dotenv

# Load .env file from project root
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Allow OAuth over HTTP for localhost (required for development)
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

# Gmail API scopes
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

# Supabase configuration
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY')
STORAGE_BUCKET = 'email-attachments'

if not SUPABASE_URL or not SUPABASE_KEY:
    raise Exception("SUPABASE_URL and SUPABASE_KEY environment variables must be set")

if not ANTHROPIC_API_KEY:
    raise Exception("ANTHROPIC_API_KEY environment variable must be set")

# Initialize clients
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

# Load prompt template
PROMPT_PATH = Path(__file__).parent / 'prompts' / 'parse_email.txt'
PROMPT_TEMPLATE = PROMPT_PATH.read_text()

# Deduplication threshold
SIMILARITY_THRESHOLD = 0.85


def get_credentials():
    """Get valid user credentials from storage or run OAuth flow."""
    creds = None

    # Check for credentials in environment variables first (for GitHub Actions)
    token_json = os.environ.get('GMAIL_TOKEN')
    if token_json:
        creds = Credentials.from_authorized_user_info(json.loads(token_json), SCOPES)
    else:
        # Fall back to local token file
        token_file = 'token.json'
        if os.path.exists(token_file):
            creds = Credentials.from_authorized_user_file(token_file, SCOPES)

    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("Refreshing expired token...")
            creds.refresh(Request())
        else:
            # Check for credentials in environment variable first
            credentials_json = os.environ.get('GMAIL_CREDENTIALS')
            if credentials_json:
                client_config = json.loads(credentials_json)
                flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
            else:
                # Fall back to local credentials file
                flow = InstalledAppFlow.from_client_secrets_file(
                    'credentials.json', SCOPES)

            # Set redirect_uri explicitly
            flow.redirect_uri = 'http://localhost'

            # Manual OAuth flow for Codespaces
            print("\n" + "="*60)
            print("AUTHORIZATION REQUIRED")
            print("="*60)
            print("\n1. Visit this URL in your browser:\n")

            # Generate authorization URL
            auth_url, _ = flow.authorization_url(prompt='consent')
            print(auth_url)

            print("\n2. After authorizing, you'll be redirected to a localhost URL")
            print("3. Copy the ENTIRE URL from your browser's address bar")
            print("4. Paste it below:\n")

            redirect_response = input("Paste the full redirect URL here: ").strip()

            # Extract code from URL
            flow.fetch_token(authorization_response=redirect_response)
            creds = flow.credentials

        # Save the credentials for the next run (only if not using env vars)
        if not os.environ.get('GMAIL_TOKEN'):
            token_file = 'token.json'
            with open(token_file, 'w') as token:
                token.write(creds.to_json())
            print(f"\nToken saved to {token_file} - future runs won't require browser auth!\n")

    return creds


def decode_base64(data):
    """Decode base64 encoded data."""
    if data:
        try:
            # Replace URL-safe characters
            data = data.replace('-', '+').replace('_', '/')
            # Decode
            return base64.b64decode(data).decode('utf-8')
        except Exception as e:
            return f"Error decoding: {str(e)}"
    return ""


def get_message_body(payload):
    """Extract the body from the email payload."""
    body_text = ""

    if 'parts' in payload:
        # Multipart message
        for part in payload['parts']:
            if part['mimeType'] == 'text/plain':
                if 'data' in part['body']:
                    body_text = decode_base64(part['body']['data'])
                    break
            elif part['mimeType'] == 'multipart/alternative':
                # Check nested parts
                if 'parts' in part:
                    for subpart in part['parts']:
                        if subpart['mimeType'] == 'text/plain':
                            if 'data' in subpart['body']:
                                body_text = decode_base64(subpart['body']['data'])
                                break
    else:
        # Simple message
        if 'data' in payload['body']:
            body_text = decode_base64(payload['body']['data'])

    return body_text


def get_header_value(headers, name):
    """Get the value of a specific header."""
    for header in headers:
        if header['name'].lower() == name.lower():
            return header['value']
    return ""


def extract_attachments(service, message_id, parts):
    """Extract attachment information from message parts."""
    attachments = []

    for part in parts:
        # Check if this part is an attachment
        if part.get('filename') and part['body'].get('attachmentId'):
            attachment_id = part['body']['attachmentId']
            filename = part['filename']
            mime_type = part['mimeType']
            size = part['body'].get('size', 0)

            # Download the attachment
            attachment = service.users().messages().attachments().get(
                userId='me',
                messageId=message_id,
                id=attachment_id
            ).execute()

            # Decode the attachment data
            file_data = base64.urlsafe_b64decode(attachment['data'])

            attachments.append({
                'filename': filename,
                'mime_type': mime_type,
                'size': size,
                'data': file_data
            })

        # Recursively check nested parts
        if 'parts' in part:
            attachments.extend(extract_attachments(service, message_id, part['parts']))

    return attachments


def upload_attachment_to_storage(attachment_data, email_gmail_id):
    """Upload attachment to Supabase Storage and return the storage path and URL."""
    filename = attachment_data['filename']
    file_data = attachment_data['data']

    # Create a unique path using email ID and filename
    storage_path = f"{email_gmail_id}/{filename}"

    try:
        # Upload file to Supabase Storage
        supabase.storage.from_(STORAGE_BUCKET).upload(
            path=storage_path,
            file=file_data,
            file_options={"content-type": attachment_data['mime_type']}
        )

        # Get the public URL (or signed URL if bucket is private)
        # For private buckets, you'd use create_signed_url instead
        storage_url = supabase.storage.from_(STORAGE_BUCKET).get_public_url(storage_path)

        return storage_path, storage_url

    except Exception as e:
        # Handle duplicate attachment (already uploaded)
        if 'Duplicate' in str(e) or '409' in str(e):
            print(f"  Attachment already exists, using existing: {filename}")
            storage_url = supabase.storage.from_(STORAGE_BUCKET).get_public_url(storage_path)
            return storage_path, storage_url
        print(f"Error uploading attachment {filename}: {e}")
        raise


def extract_original_date_from_body(body: str):
    """Extract the original email date from a forwarded email body."""
    import re
    from dateutil import parser as date_parser

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
        # "---------- Forwarded message ---------\nFrom: ...\nDate: ..."
        r'-+\s*Forwarded message\s*-+.*?Date:\s*([^\n<]+)',
    ]

    for pattern in patterns:
        match = re.search(pattern, body, re.IGNORECASE | re.DOTALL)
        if match:
            date_str = match.group(1).strip()
            try:
                parsed_date = date_parser.parse(date_str, fuzzy=True)
                return parsed_date.isoformat()
            except Exception:
                continue

    return None


def store_email_in_database(email_data, attachments_data):
    """Store email and attachments in Supabase database."""

    # Try to extract original date from forwarded email body first
    original_date = extract_original_date_from_body(email_data.get('body', ''))

    if original_date:
        email_data['date'] = original_date
        print(f"  ✓ Extracted original date: {original_date}")
    else:
        # Fall back to the header date
        try:
            from email.utils import parsedate_to_datetime
            date_obj = parsedate_to_datetime(email_data['date'])
            email_data['date'] = date_obj.isoformat()
        except Exception as e:
            print(f"Warning: Could not parse date '{email_data['date']}': {e}")
            email_data['date'] = None

    # Insert email into database
    email_result = supabase.table('emails').insert({
        'gmail_id': email_data['gmail_id'],
        'subject': email_data['subject'],
        'from_address': email_data['from'],
        'date': email_data['date'],
        'body': email_data['body']
    }).execute()

    email_id = email_result.data[0]['id']
    print(f"✓ Stored email: {email_data['subject']}")

    # Insert attachments into database
    for attachment in attachments_data:
        supabase.table('attachments').insert({
            'email_id': email_id,
            'filename': attachment['filename'],
            'file_size': attachment['size'],
            'mime_type': attachment['mime_type'],
            'storage_path': attachment['storage_path'],
            'storage_url': attachment['storage_url']
        }).execute()

        print(f"  ✓ Stored attachment: {attachment['filename']}")

    return email_id


def get_most_recent_email_timestamp():
    """Get the most recent email created_at timestamp from the database as Unix timestamp."""
    try:
        result = supabase.table('emails').select('created_at').order('created_at', desc=True).limit(1).execute()

        if result.data and len(result.data) > 0:
            created_at = result.data[0]['created_at']
            from dateutil import parser
            date_obj = parser.parse(created_at)
            # Gmail API accepts Unix timestamp for after: filter
            unix_timestamp = int(date_obj.timestamp())
            print(f"Most recent email in database: {created_at}")
            print(f"Fetching emails after timestamp: {unix_timestamp}\n")
            return unix_timestamp
        else:
            print("No emails found in database, fetching all emails\n")
            return None
    except Exception as e:
        print(f"Error querying database: {e}")
        print("Fetching all emails as fallback\n")
        return None


def parse_email_with_claude(email_data, attachment_names):
    """Send email to Claude for privacy check and item extraction."""
    attachment_str = ', '.join(attachment_names) if attachment_names else 'None'

    prompt = PROMPT_TEMPLATE.format(
        subject=email_data.get('subject', ''),
        from_address=email_data.get('from', ''),
        date=email_data.get('date', ''),
        attachments=attachment_str,
        body=email_data.get('body', '')
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

    return json.loads(json_str)


def text_similarity(a: str, b: str) -> float:
    """Calculate text similarity ratio between two strings."""
    if not a or not b:
        return 0.0
    # Normalize whitespace for comparison
    a_norm = " ".join(a.split())
    b_norm = " ".join(b.split())
    return SequenceMatcher(None, a_norm, b_norm).ratio()


def find_similar_item(new_content: str, new_date: str | None, new_urls: list[str] = None):
    """Find an existing current item with ≥85% similarity and matching date, or shared URLs."""
    if new_urls is None:
        new_urls = []

    # Fetch all current items
    result = supabase.table('items').select('id, content, date, external_urls').eq('is_current', True).execute()

    for existing in result.data:
        existing_date = existing.get('date')
        existing_urls = existing.get('external_urls') or []

        # Check for shared URLs first (strong signal)
        shared_urls = set(new_urls) & set(existing_urls)
        if shared_urls:
            # URLs match - check if dates also match (or both null)
            if new_date == existing_date:
                return existing['id'], 1.0  # Perfect match via URL

        # Fall back to text similarity (dates must match)
        if new_date != existing_date:
            continue

        sim = text_similarity(new_content, existing['content'])
        if sim >= SIMILARITY_THRESHOLD:
            return existing['id'], sim

    return None, 0.0


def supersede_item(old_item_id: str, new_item_id: str):
    """Mark old item as superseded and migrate user statuses to new item."""
    # Update old item to mark as superseded
    supabase.table('items').update({
        'is_current': False,
        'superseded_by': new_item_id
    }).eq('id', old_item_id).execute()

    # Migrate user_items from old to new
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
                pass  # User already has status for new item
            else:
                print(f"    Warning: Could not migrate user_item: {e}")


def save_item(email_id, item):
    """Save an extracted item to the database, checking for duplicates first."""
    new_content = item['content']
    new_date = item.get('date')
    new_urls = item.get('external_urls', [])

    # Check for similar existing items (must have matching date or shared URLs)
    similar_id, sim_score = find_similar_item(new_content, new_date, new_urls)

    # Insert new item (always with is_current = TRUE)
    data = {
        'email_id': email_id,
        'content': new_content,
        'date': item.get('date'),
        'external_urls': new_urls,
        'is_current': True
    }

    response = supabase.table('items').insert(data).execute()
    new_item_id = response.data[0]['id']

    # If we found a similar item, supersede it
    if similar_id:
        supersede_item(similar_id, new_item_id)
        print(f"    ↳ Superseded existing item ({sim_score*100:.0f}% similar)")

    return new_item_id


def link_attachments_to_item(item_id, attachment_filenames, all_attachments):
    """Link attachments to an item based on filename matching."""
    if not attachment_filenames:
        return

    for attachment in all_attachments:
        if attachment['filename'] in attachment_filenames:
            supabase.table('attachments').update(
                {'item_id': item_id}
            ).eq('id', attachment['id']).execute()


def store_failed_email(gmail_id):
    """Store minimal record for emails that fail privacy check."""
    try:
        supabase.table('emails').insert({
            'gmail_id': gmail_id,
            'privacy_check_passed': False
        }).execute()
        print(f"  ✗ Stored failed privacy check record")
    except Exception as e:
        # May already exist
        print(f"  ✗ Could not store failed record: {e}")


def fetch_and_store_emails():
    """Fetch emails from Gmail, run privacy check, and store only passing emails."""
    creds = get_credentials()
    service = build('gmail', 'v1', credentials=creds)

    # Get the most recent email timestamp from database
    most_recent_timestamp = get_most_recent_email_timestamp()

    # Build Gmail query - emails from vikassood@gmail.com OR k12.dc.gov domain
    query = 'from:vikassood@gmail.com OR from:*@k12.dc.gov'
    if most_recent_timestamp:
        query += f' after:{most_recent_timestamp}'

    print(f"Gmail query: {query}\n")

    # Fetch all emails using pagination
    messages = []
    page_token = None

    while True:
        # Use Gmail query to filter for emails
        if page_token:
            results = service.users().messages().list(
                userId='me',
                q=query,
                pageToken=page_token
            ).execute()
        else:
            results = service.users().messages().list(
                userId='me',
                q=query
            ).execute()

        messages.extend(results.get('messages', []))
        page_token = results.get('nextPageToken')

        if not page_token:
            break

        print(f"Fetched {len(messages)} emails so far, continuing...")

    if not messages:
        print('No new messages found matching query.')
        return

    print(f"Found {len(messages)} total emails to process\n")

    for msg in messages:
        # Get full message details
        message = service.users().messages().get(
            userId='me',
            id=msg['id'],
            format='full'
        ).execute()

        # Extract headers
        headers = message['payload']['headers']
        subject = get_header_value(headers, 'Subject')
        from_address = get_header_value(headers, 'From')
        date = get_header_value(headers, 'Date')

        # Extract body
        body = get_message_body(message['payload'])

        # Build email data
        email_data = {
            'gmail_id': message['id'],
            'subject': subject,
            'from': from_address,
            'date': date,
            'body': body
        }

        print(f"Processing: {subject}")

        # Check if email already exists to avoid duplicate processing
        existing = supabase.table('emails').select('id').eq('gmail_id', email_data['gmail_id']).execute()
        if existing.data:
            print(f"  ✓ Email already exists in database, skipping...\n")
            continue

        # Extract and download attachments (need filenames for Claude prompt)
        attachments = []
        if 'parts' in message['payload']:
            attachments = extract_attachments(service, message['id'], message['payload']['parts'])

        attachment_names = [a['filename'] for a in attachments]
        print(f"  Found {len(attachments)} attachment(s)")

        # Run Claude privacy check BEFORE storing
        print(f"  Running privacy check...")
        try:
            result = parse_email_with_claude(email_data, attachment_names)
        except json.JSONDecodeError as e:
            print(f"  ✗ Error parsing Claude response: {e}")
            continue
        except Exception as e:
            print(f"  ✗ Error calling Claude: {e}")
            continue

        if not result.get('privacy_check_passed'):
            # Privacy check failed - store minimal record only
            reason = result.get('reason', 'Unknown')
            print(f"  ✗ Privacy check failed: {reason}")
            store_failed_email(email_data['gmail_id'])
            print()
            continue

        # Privacy check passed - proceed with full storage
        print(f"  ✓ Privacy check passed")

        # Upload attachments to storage and collect metadata
        attachments_data = []
        for attachment in attachments:
            storage_path, storage_url = upload_attachment_to_storage(attachment, email_data['gmail_id'])

            attachments_data.append({
                'filename': attachment['filename'],
                'size': attachment['size'],
                'mime_type': attachment['mime_type'],
                'storage_path': storage_path,
                'storage_url': storage_url
            })

            print(f"  ✓ Uploaded: {attachment['filename']}")

        # Store email and attachments in database (with privacy_check_passed = TRUE)
        email_id = store_email_in_database(email_data, attachments_data)

        # Update email to mark privacy check as passed
        supabase.table('emails').update({'privacy_check_passed': True}).eq('id', email_id).execute()

        # Now extract and store items from Claude's response
        items = result.get('items', [])
        print(f"  Extracting {len(items)} items...")

        # Get attachment records from DB to link to items
        attachment_records = supabase.table('attachments').select('id, filename').eq('email_id', email_id).execute().data

        for item in items:
            item_id = save_item(email_id, item)

            # Link attachments if specified
            attachment_filenames = item.get('attachment_filenames', [])
            if attachment_filenames:
                link_attachments_to_item(item_id, attachment_filenames, attachment_records)
                print(f"    Linked {len(attachment_filenames)} attachment(s) to item")

        print(f"  ✓ Stored {len(items)} items")
        print()


def main():
    """Main function to fetch and store emails."""
    print("="*60)
    print("GMAIL EMAIL PARSER WITH INLINE PRIVACY CHECK")
    print("="*60)
    print(f"\nFetching emails from vikassood@gmail.com OR *@k12.dc.gov...\n")

    try:
        fetch_and_store_emails()

        print("="*60)
        print("COMPLETED SUCCESSFULLY")
        print("="*60)

    except Exception as e:
        print(f"\n✗ An error occurred: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()
