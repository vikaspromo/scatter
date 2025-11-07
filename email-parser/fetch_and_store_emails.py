#!/usr/bin/env python3
"""
Fetch emails from Gmail with attachments and store in Supabase.
Stores email data in database and attachments in Supabase Storage.
"""

import os
import json
import base64
import tempfile
from datetime import datetime
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from supabase import create_client, Client

# Allow OAuth over HTTP for localhost (required for development)
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

# Gmail API scopes
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

# Supabase configuration
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')
STORAGE_BUCKET = 'email-attachments'

if not SUPABASE_URL or not SUPABASE_KEY:
    raise Exception("SUPABASE_URL and SUPABASE_KEY environment variables must be set")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


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
        print(f"Error uploading attachment {filename}: {e}")
        raise


def store_email_in_database(email_data, attachments_data):
    """Store email and attachments in Supabase database."""

    # First, check if email already exists
    existing = supabase.table('emails').select('id').eq('gmail_id', email_data['gmail_id']).execute()

    if existing.data:
        print(f"Email {email_data['gmail_id']} already exists in database, skipping...")
        return existing.data[0]['id']

    # Convert date string to ISO format for Postgres
    try:
        # Parse the email date (Gmail format)
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


def get_most_recent_email_date():
    """Get the most recent email created_at timestamp from the database."""
    try:
        result = supabase.table('emails').select('created_at').order('created_at', desc=True).limit(1).execute()

        if result.data and len(result.data) > 0:
            created_at = result.data[0]['created_at']
            # Parse the timestamp and format it for Gmail API (YYYY/MM/DD)
            from dateutil import parser
            date_obj = parser.parse(created_at)
            gmail_date_format = date_obj.strftime('%Y/%m/%d')
            print(f"Most recent email in database: {created_at}")
            print(f"Fetching emails after: {gmail_date_format}\n")
            return gmail_date_format
        else:
            print("No emails found in database, fetching all emails\n")
            return None
    except Exception as e:
        print(f"Error querying database: {e}")
        print("Fetching all emails as fallback\n")
        return None


def fetch_and_store_emails():
    """Fetch all emails from Gmail and store in Supabase."""
    creds = get_credentials()
    service = build('gmail', 'v1', credentials=creds)

    # Get the most recent email date from database
    most_recent_date = get_most_recent_email_date()

    # Build Gmail query to filter for emails from vikassood@gmail.com
    # and after the most recent email in the database
    query = 'from:vikassood@gmail.com'
    if most_recent_date:
        query += f' after:{most_recent_date}'

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
        print('No new messages found from vikassood@gmail.com.')
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

        # Extract and download attachments
        attachments = []
        if 'parts' in message['payload']:
            attachments = extract_attachments(service, message['id'], message['payload']['parts'])

        print(f"  Found {len(attachments)} attachment(s)")

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

        # Store email and attachments in database
        store_email_in_database(email_data, attachments_data)

        print()


def main():
    """Main function to fetch and store emails."""
    print("="*60)
    print("GMAIL EMAIL PARSER WITH SUPABASE STORAGE")
    print("="*60)
    print(f"\nFetching all emails from vikassood@gmail.com...\n")

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
