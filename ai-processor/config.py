"""
Configuration loader for AI processor.
Loads API keys securely from environment variables.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from project root (parent directory)
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Validate required environment variables
REQUIRED_VARS = ['SUPABASE_URL', 'SUPABASE_KEY', 'ANTHROPIC_API_KEY']

missing_vars = [var for var in REQUIRED_VARS if not os.getenv(var)]
if missing_vars:
    raise ValueError(
        f"Missing required environment variables: {', '.join(missing_vars)}\n"
        f"Please create a .env file in the scatter/ directory with these variables.\n"
        f"See .env.example for template."
    )

# Export configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY')

# Verify keys are not placeholder values
if 'your_' in SUPABASE_URL.lower() or 'your_' in SUPABASE_KEY.lower() or 'your_' in ANTHROPIC_API_KEY.lower():
    raise ValueError(
        "API keys still contain placeholder values. "
        "Please update .env file with your actual credentials."
    )
