#!/usr/bin/env python3
"""
Test script to verify API keys are configured correctly.
Run this before running the main processing script.
"""

import sys

def test_configuration():
    """Test that all API keys are properly configured."""

    print("🔍 Testing configuration...\n")

    # Test 1: Load configuration
    try:
        from config import SUPABASE_URL, SUPABASE_KEY, ANTHROPIC_API_KEY
        print("✅ Environment variables loaded from .env file")
    except ValueError as e:
        print(f"❌ Configuration error: {e}")
        return False
    except Exception as e:
        print(f"❌ Error loading configuration: {e}")
        return False

    # Test 2: Check Supabase connection
    try:
        from supabase import create_client
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

        # Try a simple query
        result = supabase.table('emails').select('id').limit(1).execute()
        print(f"✅ Supabase connection successful (found {len(result.data)} emails to test with)")
    except Exception as e:
        print(f"❌ Supabase connection failed: {e}")
        return False

    # Test 3: Check Anthropic API
    try:
        from anthropic import Anthropic
        client = Anthropic(api_key=ANTHROPIC_API_KEY)

        # Try a simple API call with Sonnet 4.5
        response = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=10,
            messages=[{"role": "user", "content": "Say 'test'"}]
        )
        print(f"✅ Anthropic API connection successful")
        print(f"   Claude responded: {response.content[0].text}")
    except Exception as e:
        print(f"❌ Anthropic API connection failed: {e}")
        return False

    print("\n" + "="*60)
    print("🎉 All tests passed! Your configuration is ready.")
    print("="*60)
    print("\nNext step: Run process_emails.py to generate AI summaries")

    return True

if __name__ == '__main__':
    success = test_configuration()
    sys.exit(0 if success else 1)
