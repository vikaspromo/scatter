# scatter-email-parser

Gmail email parser that fetches emails and stores them in Supabase with attachment storage support.

## Features

- Fetches emails from Gmail using OAuth 2.0
- Stores email metadata in Supabase database
- Uploads attachments to Supabase Storage
- Incremental sync (only fetches new emails)
- Designed to run in GitHub Actions with secrets

## Prerequisites

1. **Google Cloud Project** with Gmail API enabled
2. **Supabase Project** with database tables and storage bucket
3. **GitHub Repository** with secrets configured

## Setup Instructions

### 1. Set Up Supabase

#### Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be provisioned

#### Create Database Tables
1. In your Supabase dashboard, go to **SQL Editor**
2. Copy the contents of `email-parser/schema.sql`
3. Paste and click **Run** to create the tables

#### Create Storage Bucket
1. Go to **Storage** in your Supabase dashboard
2. Click **New bucket**
3. Name it: `email-attachments`
4. Set as **Private** bucket
5. Click **Create bucket**

#### Get Supabase Credentials
1. Go to **Settings** → **API**
2. Copy your **Project URL** (this is your `SUPABASE_URL`)
3. Copy your **anon/public** key (this is your `SUPABASE_KEY`)

### 2. Set Up Gmail API

#### Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable the **Gmail API**:
   - Go to **APIs & Services** → **Library**
   - Search for "Gmail API"
   - Click **Enable**

#### Create OAuth 2.0 Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. If prompted, configure the OAuth consent screen:
   - User Type: **External**
   - Add your email as a test user
   - Scopes: Add `https://www.googleapis.com/auth/gmail.readonly`
4. Application type: **Desktop app**
5. Name it (e.g., "Gmail Email Parser")
6. Click **Create**
7. Download the credentials JSON file

#### Generate OAuth Token
Run the parser locally once to generate your token:

```bash
cd email-parser

# Set environment variables temporarily (or export them)
export SUPABASE_URL="your_supabase_url"
export SUPABASE_KEY="your_supabase_key"

# Place your downloaded credentials.json in this directory
# Run the script - it will open a browser for OAuth
python3 fetch_and_store_emails.py
```

Follow the browser prompts to authorize. This will create a `token.json` file.

### 3. Configure GitHub Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add the following secrets:

#### Required Secrets

| Secret Name | Value | How to Get |
|-------------|-------|------------|
| `SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API |
| `SUPABASE_KEY` | Your Supabase anon/public key | Supabase Dashboard → Settings → API |
| `GMAIL_CREDENTIALS` | Contents of `credentials.json` | Google Cloud Console (see above) |
| `GMAIL_TOKEN` | Contents of `token.json` | Generated after first local run |

#### How to Add Multi-line JSON Secrets

For `GMAIL_CREDENTIALS` and `GMAIL_TOKEN`:
1. Open the JSON file in a text editor
2. Copy the **entire contents** (including the outer `{}` braces)
3. Paste into the GitHub secret value field
4. GitHub will handle the multi-line formatting

Example format for `GMAIL_CREDENTIALS`:
```json
{"installed":{"client_id":"xxx.apps.googleusercontent.com","project_id":"xxx","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_secret":"xxx","redirect_uris":["http://localhost"]}}
```

Example format for `GMAIL_TOKEN`:
```json
{"token": "xxx", "refresh_token": "xxx", "token_uri": "https://oauth2.googleapis.com/token", "client_id": "xxx.apps.googleusercontent.com", "client_secret": "xxx", "scopes": ["https://www.googleapis.com/auth/gmail.readonly"], "expiry": "2024-01-01T00:00:00.000000Z"}
```

### 4. Test the Setup

#### Local Testing
```bash
cd email-parser

# Set environment variables
export SUPABASE_URL="your_supabase_url"
export SUPABASE_KEY="your_supabase_key"

# Run the parser
python3 fetch_and_store_emails.py
```

#### Setup Verification
```bash
# Verify Supabase setup
python3 setup_supabase.py
```

## Project Structure

```
scatter-email-parser/
├── email-parser/
│   ├── fetch_and_store_emails.py  # Main email parser script
│   ├── setup_supabase.py          # Supabase setup verification
│   ├── schema.sql                 # Database schema
│   └── requirements.txt           # Python dependencies
├── .env.example                    # Example environment variables
├── .gitignore                      # Git ignore rules
└── README.md                       # This file
```

## How It Works

1. **Authentication**: Uses OAuth 2.0 to authenticate with Gmail API
2. **Fetch Emails**: Queries Gmail for emails from `vikassood@gmail.com`
3. **Incremental Sync**: Only fetches emails newer than the most recent one in the database
4. **Store Email Data**: Saves email metadata to Supabase `emails` table
5. **Upload Attachments**: Uploads attachments to Supabase Storage bucket
6. **Track Attachments**: Stores attachment metadata in `attachments` table

## Security Notes

- Never commit `credentials.json` or `token.json` to git (they're in `.gitignore`)
- Store all sensitive credentials in GitHub Secrets
- Supabase storage bucket is private by default
- Row Level Security is enabled on database tables

## Troubleshooting

### "SUPABASE_URL and SUPABASE_KEY environment variables must be set"
Make sure you've exported the environment variables or set them in GitHub Secrets.

### "credentials.json not found"
Either place the file in `email-parser/` directory or set the `GMAIL_CREDENTIALS` environment variable.

### OAuth errors
- Ensure Gmail API is enabled in Google Cloud Console
- Verify your email is added as a test user in OAuth consent screen
- Check that redirect URI is set to `http://localhost`

### Storage bucket errors
Make sure the `email-attachments` bucket exists in your Supabase project.
