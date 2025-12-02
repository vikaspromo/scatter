# Scatter - Claude Code Guidelines

## Project Overview

Scatter helps parents at Brent Elementary manage school emails by:
1. Fetching emails from Gmail (from `vikassood@gmail.com` OR `*@k12.dc.gov`)
2. Running a Claude privacy check (reject student-specific emails)
3. Extracting actionable items from approved emails
4. Displaying items in a mobile app with inbox/remind functionality

## Directory Structure

```
scatter/
├── .claude/           # Claude Code guidance (this file, USE-CASES.md)
├── backend/           # Email fetching, Claude processing, prompts
├── mobile-app/        # Expo/React Native app
├── migrations/        # Database migrations (keep versioned)
├── temp/              # One-time scripts, experiments, old files
└── .env               # Local environment variables (not in git)
```

### `temp/`
One-time scripts and temporary files go here:
- Database cleanup scripts
- Data migration scripts (after run)
- Debug/test scripts
- Old schema files

### `migrations/`
Database migrations stay versioned here, even after applied.

## Main Scripts

| Script | Purpose |
|--------|---------|
| `backend/fetch_and_store_emails.py` | Fetches emails, runs privacy check, stores items |
| `backend/config.py` | Loads API keys from .env |
| `backend/prompts/parse_email.txt` | Claude prompt for privacy check + item extraction |

## Environment Variables

Required in `.env`:
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJ...  (anon key)
ANTHROPIC_API_KEY=sk-ant-...
```

For local Gmail OAuth:
- `credentials.json` - Google OAuth client config
- `token.json` - Generated after first auth flow

For GitHub Actions (optional):
- `GMAIL_CREDENTIALS` - Contents of credentials.json
- `GMAIL_TOKEN` - Contents of token.json

## Database Schema

### Core Tables
- `emails` - Email metadata, body, privacy_check_passed flag
- `items` - Extracted items with content (raw HTML), optional date
- `attachments` - File attachments linked to emails and items
- `user_items` - Per-user status (inbox/done/remind) for each item

### Key Relationships
```
emails (1) → (n) items
emails (1) → (n) attachments
items (1) → (n) attachments (via item_id)
items (1) → (n) user_items
```

## Email Processing Flow

1. Query Gmail: `from:vikassood@gmail.com OR from:*@k12.dc.gov after:{timestamp}`
2. For each email:
   - Fetch body + subject
   - Call Claude for privacy check + item extraction
   - If passes: store email, items, attachments
   - If fails: store only gmail_id with `privacy_check_passed = FALSE`

## Gmail ID Lookup

To find an email by its `gmail_id` in the Gmail web UI:
```
https://mail.google.com/mail/u/0/#inbox/{gmail_id}
```

## Security Notes

- Never commit `.env`, `credentials.json`, or `token.json`
- Use anon key for SUPABASE_KEY (not service_role)
- Mobile app only needs SUPABASE_URL and SUPABASE_KEY
- ANTHROPIC_API_KEY stays server-side only
