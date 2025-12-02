# Scatter - Use Cases

## Overview

Scatter helps parents of Brent Elementary students manage the high volume of school communications by automatically parsing emails, extracting actionable items, and providing mobile reminders for tasks and events.

## Target User

**Parent of one or more students at Brent Elementary**

- Receives frequent emails from the school
- Wants to save and organize helpful information
- Needs mobile notification reminders for tasks and events

---

## Email Retrieval

### Source
- Query Gmail for emails matching:
  - `from:vikassood@gmail.com` OR `from:*@k12.dc.gov`
  - `after:{most_recent_email_timestamp}` (full datetime, not just date)

### Process
1. Connect to Gmail API using stored credentials
2. Query for new emails since the last processed timestamp
3. For each email found:
   a. Retrieve email body + subject
   b. Send to Claude for privacy check + item extraction
   c. **If passes:** Store email in `emails` table, store extracted items
   d. **If fails:** Store only `gmail_id` with `privacy_check_passed = FALSE`

---

## Email Parsing

### Privacy Check
Before processing, Claude evaluates each email to determine:
- The email is **not specific to an individual student**
- The email is intended for **wide distribution** (all parents in a class or broader audience)

### If Check Passes
Claude parses the raw email and returns a structured JSON containing:

1. **Email Metadata** (stored in `emails` table)
   - Sender, Subject, Date/time received, Full raw email body
   - `privacy_check_passed = TRUE`

2. **Extracted Items** (stored in `items` table)
   - Each distinct topic or piece of information is stored as a separate item
   - `content`: Raw HTML/text from the email (school's exact language, no summarization)
   - `date`: Optional date if the item is time-sensitive
   - Each item linked to its source `email_id`
   - Attachments linked to items via `attachments.item_id`

3. **User Status** (stored in `user_items` table)
   - Each user has their own status for each item
   - `status`: 'inbox', 'done', or 'remind'
   - `remind_at`: Optional timestamp for push notification

### If Check Fails
- `privacy_check_passed = FALSE` recorded on the email
- Email body cleared (only gmail_id retained)
- Prevents reprocessing of the same email

---

## Mobile UX

### Tab Structure

#### 1. Inbox Tab
- Displays all extracted items
- Sorted by newest first (based on source email date)
- Each item displays the school's exact message (raw HTML/text content)

**User Actions:**
- **Done** - Removes item from Inbox (marks as completed)
- **Save and Remind** - Moves item to Remind tab for follow-up

#### 2. Remind Tab
- Contains items the user has saved for reminders
- User can set notification preferences for each item
- Mobile push notifications alert users about upcoming tasks/events

#### 3. Settings Tab
- Notification preferences
- Account management
- App configuration

---

## Data Flow Summary

```
Gmail API Query:
  from:vikassood@gmail.com OR from:*@k12.dc.gov
  after:{last_processed_timestamp}
         │
         ▼
    For Each Email:
         │
         ▼
    Fetch body + subject
         │
         ▼
    Claude: Privacy Check + Item Extraction
         │
    ┌────┴────┐
    │         │
  Pass      Fail
    │         │
    ▼         ▼
Store in DB:     Store only:
- emails (body)  - gmail_id
- items          - privacy_check_passed = FALSE
- attachments
         │
         ▼
    Mobile App
    (Inbox → Done/Remind)
         │
         ▼
    Push Notifications
```
