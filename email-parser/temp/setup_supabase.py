#!/usr/bin/env python3
"""
Setup script to initialize Supabase database tables and storage bucket.
Run this once before using the email parser.
"""

import os
from supabase import create_client, Client

# Get Supabase credentials from environment
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    raise Exception("SUPABASE_URL and SUPABASE_KEY environment variables must be set")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def create_storage_bucket():
    """Check if storage bucket exists and provide setup instructions if not."""
    bucket_name = "email-attachments"

    try:
        # Try to list buckets to check if our bucket exists
        buckets = supabase.storage.list_buckets()
        bucket_exists = any(bucket['name'] == bucket_name for bucket in buckets)

        if bucket_exists:
            print(f"✓ Storage bucket '{bucket_name}' already exists")
        else:
            print(f"\n⚠️  Storage bucket '{bucket_name}' needs to be created:")
            print("\nOption 1: Create via Supabase Dashboard (Recommended)")
            print("1. Go to: https://app.supabase.com/project/" + SUPABASE_URL.split('//')[1].split('.')[0] + "/storage/buckets")
            print("2. Click 'New bucket'")
            print("3. Name: email-attachments")
            print("4. Public bucket: No (keep private)")
            print("5. Click 'Create bucket'\n")

            print("Option 2: Use Service Role Key (if available)")
            print("Set SUPABASE_SERVICE_KEY environment variable and run this script again\n")

    except Exception as e:
        print(f"✗ Error checking storage buckets: {e}")
        print("\n⚠️  Manual bucket creation required:")
        print("1. Go to: https://app.supabase.com/project/" + SUPABASE_URL.split('//')[1].split('.')[0] + "/storage/buckets")
        print("2. Click 'New bucket'")
        print("3. Name: email-attachments")
        print("4. Public bucket: No")
        print("5. Click 'Create bucket'\n")

def create_tables():
    """Create database tables by executing the schema.sql file."""
    try:
        # Read the schema file
        with open('schema.sql', 'r') as f:
            schema_sql = f.read()

        # Split into individual statements and execute
        # Note: Supabase Python client doesn't have direct SQL execution
        # You'll need to run schema.sql manually in the Supabase SQL Editor
        print("\n⚠️  Database tables need to be created manually:")
        print("1. Go to your Supabase dashboard: " + SUPABASE_URL.replace('https://', 'https://app.supabase.com/project/'))
        print("2. Navigate to SQL Editor")
        print("3. Copy and paste the contents of 'schema.sql' file")
        print("4. Click 'Run' to execute the SQL\n")

    except FileNotFoundError:
        print("✗ schema.sql file not found")

def main():
    """Main setup function."""
    print("="*60)
    print("SUPABASE SETUP")
    print("="*60)
    print(f"\nConnecting to Supabase at: {SUPABASE_URL}\n")

    # Create storage bucket
    create_storage_bucket()

    # Instructions for creating tables
    create_tables()

    print("\n" + "="*60)
    print("Setup process completed!")
    print("="*60 + "\n")

if __name__ == '__main__':
    main()
