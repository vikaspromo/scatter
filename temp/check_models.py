#!/usr/bin/env python3
"""
Check which Claude models are available with your API key.
"""

from anthropic import Anthropic
from config import ANTHROPIC_API_KEY

client = Anthropic(api_key=ANTHROPIC_API_KEY)

print("🔍 Testing Claude model availability...\n")

# List of models to test (newest first)
models_to_test = [
    # Claude 4 models (2025)
    "claude-sonnet-4-5-20250929",   # Latest Sonnet 4.5
    "claude-sonnet-4-20250514",      # Sonnet 4
    # Claude 3.5 models (2024)
    "claude-3-5-sonnet-20241022",
    "claude-3-5-sonnet-20240620",
    # Older models
    "claude-3-haiku-20240307",
]

available_models = []

for model in models_to_test:
    try:
        response = client.messages.create(
            model=model,
            max_tokens=10,
            messages=[{"role": "user", "content": "test"}]
        )
        print(f"✅ {model} - AVAILABLE")
        available_models.append(model)
    except Exception as e:
        error_msg = str(e)
        if "404" in error_msg or "not_found" in error_msg.lower():
            print(f"❌ {model} - NOT FOUND")
        elif "401" in error_msg or "authentication" in error_msg.lower():
            print(f"❌ {model} - AUTH ERROR")
        else:
            print(f"⚠️  {model} - ERROR: {error_msg[:100]}")

print("\n" + "="*60)
if available_models:
    print("✅ Available Sonnet models for your API key:")
    for model in available_models:
        if "sonnet" in model.lower():
            print(f"   • {model}")
    print("\nRecommendation: Use the latest Sonnet model for best quality")
else:
    print("⚠️  No models found. Check your API key permissions.")
print("="*60)
