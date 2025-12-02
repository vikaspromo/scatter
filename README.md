# Scatter

Email management app for parents at Brent Elementary. Automatically fetches school emails, filters out student-specific content, extracts actionable items, and displays them in a mobile app.

## How It Works

1. **Fetch** - Gmail API retrieves emails from school senders
2. **Filter** - Claude AI rejects student-specific emails (privacy check)
3. **Extract** - Claude extracts individual items/topics from each email
4. **Display** - Mobile app shows items in an inbox with done/remind actions

## Quick Start (Local Development)

### Prerequisites
- Python 3.9+
- Node.js 18+
- Supabase account
- Google Cloud project with Gmail API enabled
- Anthropic API key

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/scatter.git
cd scatter

# Python dependencies
pip install -r email-parser/requirements.txt

# Mobile app dependencies
cd mobile-app && npm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Set Up Gmail OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable Gmail API
3. Create OAuth 2.0 credentials (Desktop app)
4. Download `credentials.json` to `email-parser/`
5. Run the fetch script - it will prompt for OAuth:

```bash
cd email-parser
python3 fetch_and_store_emails.py
```

### 4. Run the Mobile App

```bash
cd mobile-app
npx expo start
```

## Project Structure

```
scatter/
├── email-parser/          # Gmail fetching + Claude processing
│   ├── fetch_and_store_emails.py
│   ├── credentials.json   # (not in git)
│   └── token.json         # (not in git)
├── ai-processor/          # Claude prompts and config
│   ├── config.py
│   └── prompts/
├── mobile-app/            # Expo React Native app
├── migrations/            # Database migrations
├── temp/                  # One-time scripts
└── .env                   # Environment variables (not in git)
```

## GitHub Actions (Optional)

To run email fetching on a schedule:

### Required Secrets

| Secret | Description |
|--------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_KEY` | Supabase anon/public key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `GMAIL_CREDENTIALS` | Contents of `credentials.json` |
| `GMAIL_TOKEN` | Contents of `token.json` |

### Adding Secrets

1. Go to your repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each secret (paste JSON contents directly for multi-line values)

## Security

- **Never commit** `.env`, `credentials.json`, or `token.json`
- Use **anon key** for SUPABASE_KEY (not service_role)
- ANTHROPIC_API_KEY stays **server-side only**
- Mobile app only needs SUPABASE_URL and SUPABASE_KEY

### If a Key is Exposed

1. **Anthropic**: Revoke at https://console.anthropic.com/settings/keys
2. **Supabase**: Reset at your project's Settings → API
3. **Gmail**: Revoke at https://myaccount.google.com/permissions

## Troubleshooting

### "SUPABASE_URL and SUPABASE_KEY must be set"
Export environment variables or check your `.env` file.

### OAuth errors
- Ensure Gmail API is enabled in Google Cloud Console
- Add your email as a test user in OAuth consent screen
- Check redirect URI is `http://localhost`

### Token expiration
If GMAIL_TOKEN expires, regenerate locally by running `fetch_and_store_emails.py` and completing the OAuth flow again.
