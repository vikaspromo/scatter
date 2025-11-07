# GitHub Secrets Configuration Guide

## Quick Setup Checklist

Go to your repository: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

### Required Secrets (4 total)

- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_KEY`
- [ ] `GMAIL_CREDENTIALS`
- [ ] `GMAIL_TOKEN`

---

## 1. SUPABASE_URL

**Where to find it:**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy the **Project URL**

**Example value:**
```
https://abcdefghijklmnop.supabase.co
```

---

## 2. SUPABASE_KEY

**Where to find it:**
1. Same location as SUPABASE_URL
2. Under **Project API keys**
3. Copy the **anon/public** key (NOT the service_role key)

**Example value:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.example
```

---

## 3. GMAIL_CREDENTIALS

**Where to get it:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services** → **Credentials**
3. Create or download your OAuth 2.0 Client ID (Desktop app)
4. Open the downloaded `credentials.json` file
5. Copy the **entire JSON contents**

**Important:** Copy the ENTIRE file contents as a single line or multi-line JSON

**Example format:**
```json
{
  "installed": {
    "client_id": "123456789-abc.apps.googleusercontent.com",
    "project_id": "my-project",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_secret": "GOCSPX-xxxxxxxxxxxxx",
    "redirect_uris": ["http://localhost"]
  }
}
```

---

## 4. GMAIL_TOKEN

**Where to get it:**

This file is generated after you run the OAuth flow locally for the first time.

### Steps to generate token.json:

1. **Set up local environment:**
   ```bash
   cd email-parser
   export SUPABASE_URL="your_url"
   export SUPABASE_KEY="your_key"
   ```

2. **Place credentials.json in the email-parser directory**

3. **Run the script:**
   ```bash
   python3 fetch_and_store_emails.py
   ```

4. **Follow the OAuth prompts:**
   - A URL will be printed to the console
   - Open it in your browser
   - Authorize the application
   - Copy the redirect URL from your browser
   - Paste it back into the terminal

5. **Find the generated token.json file:**
   ```bash
   cat email-parser/token.json
   ```

6. **Copy the entire JSON contents**

**Example format:**
```json
{
  "token": "ya29.a0AfB_byC...",
  "refresh_token": "1//0gXXXXXXXXXXXXXXX",
  "token_uri": "https://oauth2.googleapis.com/token",
  "client_id": "123456789-abc.apps.googleusercontent.com",
  "client_secret": "GOCSPX-xxxxxxxxxxxxx",
  "scopes": ["https://www.googleapis.com/auth/gmail.readonly"],
  "expiry": "2024-11-07T14:30:00.000000Z"
}
```

---

## Adding Secrets to GitHub

For each secret:

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Enter the **Name** (exactly as shown above)
5. Paste the **Value**
6. Click **Add secret**

### Tips for Multi-line JSON:

- You can paste the JSON with line breaks or as a single line
- GitHub will handle the formatting automatically
- Make sure to include the opening `{` and closing `}`
- Don't add any extra quotes around the JSON

---

## Verification

After adding all secrets, you can:

1. **Test manually:**
   - Go to **Actions** tab in your repository
   - Select "Fetch and Store Emails" workflow
   - Click "Run workflow"
   - Check the logs for any errors

2. **Check the workflow file:**
   - The workflow is defined in `.github/workflows/fetch-emails.yml`
   - It shows how the secrets are used as environment variables

---

## Security Best Practices

- Never commit these credentials to git
- Never share these secrets publicly
- Rotate credentials if they are compromised
- Use the **anon** key for SUPABASE_KEY, not service_role
- Limit OAuth scope to `gmail.readonly` only

---

## Troubleshooting

### "Secret not found" errors
- Check that secret names match exactly (case-sensitive)
- Verify secrets are added under "Actions" not "Codespaces" or "Dependabot"

### Token expiration
- If GMAIL_TOKEN expires, regenerate it locally and update the secret
- The refresh_token should prevent this from happening frequently

### Permission denied
- Ensure your email is added as a test user in Google Cloud OAuth consent screen
- Check that Gmail API is enabled in your Google Cloud project
