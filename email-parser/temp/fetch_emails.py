#!/usr/bin/env python3
"""
Fetch the 3 most recent emails from Gmail and print them as JSON.
Handles OAuth authentication in Codespaces environment.
"""

import os
import json
import base64
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# Allow OAuth over HTTP for localhost (required for development)
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

# If modifying these scopes, delete the file token.json.
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

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

def fetch_recent_emails(max_results=3):
    """Fetch the most recent emails forwarded by vikassood@gmail.com."""
    creds = get_credentials()
    service = build('gmail', 'v1', credentials=creds)

    # Use Gmail query to filter for emails from vikassood@gmail.com
    # This is much more efficient than fetching and filtering manually
    results = service.users().messages().list(
        userId='me',
        q='from:vikassood@gmail.com',
        maxResults=max_results
    ).execute()

    messages = results.get('messages', [])

    if not messages:
        print('No messages found from vikassood@gmail.com.')
        return []

    emails = []

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

        # Build email object
        email_data = {
            'id': message['id'],
            'subject': subject,
            'from': from_address,
            'date': date,
            'body': body
            # Uncomment the line below if you need the full raw message data:
            # 'raw_message': message
        }

        emails.append(email_data)

    return emails

def main():
    """Main function to fetch and print emails."""
    print("Fetching 3 most recent emails forwarded by vikassood@gmail.com...\n")

    try:
        emails = fetch_recent_emails(max_results=3)

        # Print as JSON
        print(json.dumps(emails, indent=2, ensure_ascii=False))

    except Exception as e:
        print(f"An error occurred: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
