# AILO Website - Project Context

Last updated: January 2025

## Project Overview

AILO is a matchmaking service website built with Next.js 16. The main flow is:
1. User takes a qualifying quiz on `/apply`
2. Based on answers, they're routed to:
   - **Qualified** → `/book-call` (Calendly booking)
   - **Waitlist** → Inline confirmation (outside South Florida)
   - **Not Ready** → `/not-ready` (newsletter signup)

---

## Tech Stack

- **Framework**: Next.js 16.1.1 (App Router)
- **Database**: Turso (SQLite edge database)
- **Email**: Resend
- **Booking**: Calendly (embedded widget)
- **Analytics**: Google Analytics 4
- **Deployment**: Vercel
- **CRM**: Currently disconnected (was HubSpot, pending rewire)

---

## Git Remotes

```bash
# Primary remote (use this one)
ailo    https://github.com/mloh-1/ailo.git

# Old remote (ignore)
origin  https://github.com/UrosMijalkovic/ailo-website-poc.git
```

**Push command**: `git push ailo main`

---

## Key Files & Architecture

### Quiz Flow
```
src/app/apply/page.tsx          → Quiz page wrapper
src/app/apply/QuizContainer.tsx → Quiz logic & state management
src/components/quiz/            → Quiz UI components
src/lib/quiz-data.ts            → Questions & scoring logic
src/lib/quiz-helpers.ts         → Answer text mappings
```

### API Routes
```
src/app/api/quiz-submit/route.ts           → Saves quiz data to DB, sets booking cookie
src/app/api/send-booking-confirmation/     → Sends email after Calendly booking
src/app/api/waitlist/route.ts              → Waitlist signup
src/app/api/newsletter/route.ts            → Newsletter signup
src/app/api/cron/call-reminders/route.ts   → Call reminder emails (DISABLED - needs CRM)
src/app/api/calendly-availability/         → Checks Calendly slot availability
src/app/api/calendly-oauth/                → Calendly OAuth callback
```

### Core Libraries
```
src/lib/db.ts              → Turso database client & schema
src/lib/email.ts           → Resend email functions
src/lib/analytics.ts       → GA4 tracking
src/lib/quiz-helpers.ts    → Quiz answer mappings
src/lib/rate-limit.ts      → API rate limiting
src/lib/recaptcha.ts       → reCAPTCHA verification
src/lib/calendly-oauth.ts  → Calendly OAuth helpers
```

### Pages
```
src/app/page.tsx           → Homepage
src/app/apply/             → Quiz page
src/app/book-call/         → Calendly booking page
src/app/not-ready/         → "Not ready" outcome page
src/app/waitlist/          → Waitlist page
src/app/about/             → About page
src/app/the-science/       → Science page
src/app/duo/               → Duo (couples) page
src/app/blog/              → Blog listing & posts
```

---

## Database Schema (Turso)

```sql
-- Main quiz submissions table
quiz_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_uuid TEXT UNIQUE,     -- Links to Calendly booking
  name TEXT NOT NULL,
  email TEXT NOT NULL,          -- Email from quiz form
  email_calendly TEXT,          -- Email from Calendly (may differ)
  phone TEXT NOT NULL,
  location TEXT,                -- Q1 full text
  intent TEXT,                  -- Q2 full text
  availability TEXT,            -- Q3 full text
  investment TEXT,              -- Q4 full text
  timeline TEXT,                -- Q5 full text
  outcome TEXT NOT NULL,        -- qualified | waitlist | not-ready
  lead_source TEXT DEFAULT 'website',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)

-- Waitlist subscribers
waitlist_subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  city TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)

-- Newsletter subscribers
newsletter_subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  source TEXT DEFAULT 'not-ready',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

---

## Booking UUID System

The website uses a UUID to link quiz submissions with Calendly bookings:

1. **Quiz Submit** → UUID generated, saved to DB, stored in HTTP-only cookie
2. **Book-Call Page** → Reads UUID from cookie (server-side)
3. **Calendly Widget** → UUID passed as hidden field `a2`
4. **Calendly Webhook** → Receives UUID, can update `email_calendly` field

**Cookie Details:**
- Name: `booking_id`
- HttpOnly: true (invisible to JavaScript)
- Secure: true in production
- SameSite: strict
- MaxAge: 24 hours

**Why two email fields?**
- `email` = what user entered in quiz form
- `email_calendly` = what user entered in Calendly (may differ)
- `booking_uuid` links them together

---

## CRM Integration (PENDING)

CRM was HubSpot, now disconnected. Needs to be rewired to new CRM.

### What needs CRM:

1. **Quiz Submit** (`src/app/api/quiz-submit/route.ts`)
   - Check if user already has call scheduled (prevent duplicates)
   - Create/update contact with quiz data

2. **Call Reminders** (`src/app/api/cron/call-reminders/route.ts`)
   - Query for qualified users who haven't booked
   - Send reminder emails at days 2, 4, 9
   - Currently returns placeholder response

3. **Calendly Webhook** (not yet created)
   - Update call_status when booking confirmed

### CRM Properties Needed:
```
firstname, email, phone, lead_source, location,
intent, availability, investment, timeline,
quiz_outcome, user_status, access_to_ailo_unlimited, call_status
```

### Previous HubSpot Code Reference:
```bash
git show 2432b5c:src/app/api/quiz-submit/route.ts
git show 2432b5c:src/app/api/cron/call-reminders/route.ts
```

---

## Environment Variables

### Required for Vercel:
```env
# Database
TURSO_DATABASE_URL=libsql://xxx
TURSO_AUTH_TOKEN=xxx

# Email
RESEND_API_KEY=xxx

# Calendly
NEXT_PUBLIC_CALENDLY_URL=https://calendly.com/xxx/discovery-call
CALENDLY_CLIENT_ID=xxx
CALENDLY_CLIENT_SECRET=xxx
CALENDLY_REDIRECT_URI=https://your-domain.com/api/calendly-oauth

# reCAPTCHA
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=xxx
RECAPTCHA_SECRET_KEY=xxx

# Analytics
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-xxx

# Cron
CRON_SECRET=xxx

# CRM (add when rewiring)
# CRM_ACCESS_TOKEN=xxx
```

---

## Calendly Setup

### Custom Questions (in Calendly Event Type):
- **a1**: Phone number (prefilled from quiz)
- **a2**: Booking UUID (hidden, for tracking)

### OAuth:
- Separate OAuth app for website (not shared with n8n)
- Redirect URI: `https://your-domain.com/api/calendly-oauth`

---

## Quiz Outcome Logic

Located in `src/lib/quiz-data.ts`:

```
Q1 (Location):
  A = South Florida → +3 points
  B/C/D = Outside → 0 points (goes to waitlist)

Q2-Q5: A=3, B=2, C=1, D=0 points

Total Score:
  12-15 → Qualified
  8-11  → Qualified (if in South Florida) / Waitlist (if outside)
  0-7   → Not Ready
```

---

## Email Templates

Located in `src/lib/email.ts`:

- `sendWaitlistConfirmation(email, city)` - Waitlist signup
- `sendBookingConfirmation(email, name)` - After Calendly booking
- `sendCallReminder(email, name, reminderNumber)` - Call reminders (1, 2, 3)
- `sendBookingCancelledNotification(email, name)` - If booking cancelled

---

## Common Commands

```bash
# Development
npm run dev

# Build
npm run build

# Push to production
git add -A && git commit -m "message" && git push ailo main

# View previous HubSpot implementation
git show 2432b5c:src/app/api/quiz-submit/route.ts
```

---

## Recent Changes (This Session)

1. **Removed HubSpot CRM** - All API calls removed, pending rewire to new CRM
2. **Added Booking UUID System** - Links quiz submissions to Calendly bookings
3. **UUID stored in HTTP-only cookie** - Hidden from user (not in URL)
4. **Database schema updated** - Added `booking_uuid` and `email_calendly` columns

---

## Next Steps (TODO)

- [ ] Wire up new CRM
- [ ] Create Calendly webhook endpoint to capture bookings
- [ ] Set up Calendly custom questions (a1=phone, a2=uuid, both hidden)
- [ ] Re-enable call reminder cron once CRM is connected
