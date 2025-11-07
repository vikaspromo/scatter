# Gmail Email Parser with Supabase Storage

Fetch emails from Gmail with attachments and store them in Supabase database with files in Supabase Storage.

## Features

- Fetch emails from Gmail using OAuth authentication
- Download email attachments
- Upload attachments to Supabase Storage
- Store email metadata in Supabase database
- Store attachment metadata with links to stored files

## Setup Instructions

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Set Up Supabase Database

1. Go to your Supabase SQL Editor: https://app.supabase.com/project/vbldlqbhhcoeobimeeab/sql/new
2. Copy the contents of `schema.sql`
3. Paste and run the SQL to create the `emails` and `attachments` tables

### 3. Create Supabase Storage Bucket

1. Go to Supabase Storage: https://app.supabase.com/project/vbldlqbhhcoeobimeeab/storage/buckets
2. Click "New bucket"
3. Name: `email-attachments`
4. Public bucket: **No** (keep private)
5. Click "Create bucket"

### 4. Configure Storage Bucket Policies (Important!)

After creating the bucket, you need to set up policies to allow file uploads:

1. Click on the `email-attachments` bucket
2. Go to "Policies" tab
3. Click "New Policy"
4. For testing, you can create a policy that allows all operations:
   - Policy name: `Allow all operations`
   - Target roles: `authenticated`, `anon`
   - Policy definition: `true`
   - Allowed operations: SELECT, INSERT, UPDATE, DELETE

**Note:** For production, you should create more restrictive policies based on your security requirements.

### 5. Verify Setup

Run the setup verification script:

```bash
python3 setup_supabase.py
```

This will check if your storage bucket exists and provide instructions if setup is incomplete.

## Usage

### Fetch Emails and Store in Supabase

```bash
python3 fetch_and_store_emails.py
```

This will:
1. Fetch the 3 most recent emails from vikassood@gmail.com
2. Download any attachments
3. Upload attachments to Supabase Storage
4. Store email data in the `emails` table
5. Store attachment metadata in the `attachments` table

### Just Fetch Emails (Original Script)

If you only want to fetch emails as JSON without storing:

```bash
python3 fetch_emails.py
```

## Database Schema

### `emails` Table

- `id` - UUID primary key
- `gmail_id` - Unique Gmail message ID
- `subject` - Email subject
- `from_address` - Sender email address
- `date` - Email date/time
- `body` - Email body text
- `created_at` - Record creation timestamp

### `attachments` Table

- `id` - UUID primary key
- `email_id` - Foreign key to emails table
- `filename` - Original filename
- `file_size` - File size in bytes
- `mime_type` - File MIME type
- `storage_path` - Path in Supabase Storage
- `storage_url` - URL to access the file
- `created_at` - Record creation timestamp

## Environment Variables

The following environment variables should be set (already configured in your Codespace secrets):

- `GMAIL_TOKEN` - Gmail OAuth token (JSON)
- `GMAIL_CREDENTIALS` - Gmail OAuth credentials (JSON)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Your Supabase anon/public key

## Troubleshooting

### "Row-level security policy" errors

Make sure you've set up the storage bucket policies (Step 4 above). Without proper policies, you won't be able to upload files.

### "Bucket not found" errors

Verify the bucket name is exactly `email-attachments` and that it exists in your Supabase project.

### Email already exists

The script checks for duplicate emails by `gmail_id` and will skip emails that are already in the database.

## Files

- `fetch_emails.py` - Original script that just fetches and prints emails as JSON
- `fetch_and_store_emails.py` - Full solution that stores emails and attachments in Supabase
- `setup_supabase.py` - Setup verification script
- `schema.sql` - Database schema definition
- `requirements.txt` - Python dependencies
