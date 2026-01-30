# AILO Website - CRM Integration Context

This document contains all the information needed to rewire the CRM integration (previously HubSpot).

## Overview

The website has a quiz flow that collects user information and determines their outcome (qualified, waitlist, or not-ready). This data needs to be synced to a CRM for sales follow-up and automated email reminders.

---

## Integration Points

### 1. Quiz Submission (`src/app/api/quiz-submit/route.ts`)

When a user completes the quiz, the following needs to happen:

#### A. Check for Existing Call Scheduled
Before allowing a new submission, check if the user already has a call scheduled to prevent duplicate bookings.

```typescript
// Pseudocode - implement for new CRM
async function checkCrmCallStatus(email: string): Promise<{ exists: boolean; callScheduled: boolean }> {
  // Query CRM for contact by email
  // Check if call_status === "Call Scheduled"
  // Return { exists: true/false, callScheduled: true/false }
}
```

If `callScheduled` is true, return:
```typescript
return NextResponse.json(
  { error: "call_already_scheduled", message: "You already have a call scheduled with us!" },
  { status: 409 }
);
```

The frontend (`src/app/apply/QuizContainer.tsx`) already handles this error and shows a friendly message.

#### B. Create/Update Contact
After saving to the database, sync the contact to the CRM.

```typescript
// Pseudocode - implement for new CRM
async function sendToCrm(data: {
  name: string;
  email: string;
  phone: string;
  answers: Record<string, string>; // q1-q5
  outcome: string; // "qualified" | "waitlist" | "not-ready"
}): Promise<void> {
  // Build contact payload (see properties below)
  // Try to create contact
  // If contact exists (conflict), update instead
}
```

---

### 2. Call Reminder Cron (`src/app/api/cron/call-reminders/route.ts`)

Sends automated reminder emails to qualified users who haven't booked a call.

#### Schedule
- **Day 2**: First reminder
- **Day 4**: Second reminder
- **Day 9**: Third reminder (final)

#### Query Logic
Find contacts where:
- `quiz_outcome` = "Qualified"
- `call_status` != "Call Scheduled"
- `createdate` is within the target day range

#### Implementation Notes
- Use pagination (up to 500 contacts per reminder)
- Send emails in parallel batches of 10
- Process all 3 reminder days in parallel
- Email function: `sendCallReminder(email, name, reminderNumber)` from `@/lib/email`

```typescript
// Pseudocode for querying contacts
async function getContactsForReminder(dayNumber: number): Promise<Contact[]> {
  // Calculate date range for contacts created exactly X days ago
  const startDate = new Date();
  startDate.setUTCHours(0, 0, 0, 0);
  startDate.setUTCDate(startDate.getUTCDate() - dayNumber);

  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 1);

  // Query CRM with filters:
  // - quiz_outcome = "Qualified"
  // - call_status != "Call Scheduled"
  // - createdate >= startDate AND createdate < endDate

  // Paginate through results (100 per page, max 500 total)
}
```

#### Cron Setup
Using cron-job.org (free tier):
- URL: `https://your-domain.com/api/cron/call-reminders`
- Header: `x-cron-secret: [CRON_SECRET env var]`
- Schedule: Daily at a reasonable hour (e.g., 9 AM EST)

---

### 3. Calendly Webhook (Optional - for call status updates)

When a user books a call via Calendly, update their CRM status.

```typescript
// In a Calendly webhook handler
async function updateCrmCallStatus(email: string, status: string): Promise<void> {
  // Search for contact by email
  // Update call_status property to "Call Scheduled"
}
```

---

## CRM Contact Properties

### Required Properties

| Property | Type | Description | Example Values |
|----------|------|-------------|----------------|
| `firstname` | string | User's name | "John Doe" |
| `email` | string | User's email | "john@example.com" |
| `phone` | string | User's phone | "+1234567890" |
| `lead_source` | string | Where lead came from | "Website", "App" |
| `location` | string | User's location category | "Matchmaking Location", "Waitlist Location" |
| `intent` | string | Q2 answer (full text) | "A committed relationship — I'm ready" |
| `availability` | string | Q3 answer (full text) | "Open and available" |
| `investment` | string | Q4 answer (full text) | "Willing to invest" |
| `timeline` | string | Q5 answer (full text) | "As soon as I find the right person" |
| `quiz_outcome` | string | Quiz result | "Qualified", "Waitlist", "Not-ready" |
| `user_status` | string | User status | "No info" |
| `access_to_ailo_unlimited` | string | Access status | "In Review", "Rejected" |
| `call_status` | string | Booking status | "Call Scheduled", "" |

### Property Logic

**Location** (based on Q1 answer):
- Q1 = "A" → "Matchmaking Location" (South Florida)
- Q1 = "B", "C", "D" → "Waitlist Location" (Outside South Florida)

**Access to AILO Unlimited**:
- outcome = "not-ready" → "Rejected"
- outcome = "qualified" or "waitlist" → "In Review"

**Quiz Outcome** (capitalize for CRM):
- "qualified" → "Qualified"
- "waitlist" → "Waitlist"
- "not-ready" → "Not-ready"

---

## Quiz Answer Mappings

Use `src/lib/quiz-helpers.ts` for converting answer codes to full text.

### Q1 - Location
| Code | Text |
|------|------|
| A | South Florida (Palm Beach, Broward, Miami-Dade) |
| B | Florida (outside South Florida) |
| C | U.S. (outside Florida) |
| D | Outside the U.S. |

### Q2 - Intent
| Code | Text |
|------|------|
| A | A committed relationship — I'm ready |
| B | Something serious, but balancing priorities |
| C | Exploring, no rush |
| D | Just curious about AILO |

### Q3 - Availability
| Code | Text |
|------|------|
| A | Open and available |
| B | Mostly open, still processing past experiences |
| C | Working on it |
| D | Not fully available right now |

### Q4 - Investment
| Code | Text |
|------|------|
| A | Willing to invest |
| B | Open to investing, but not certain |
| C | Prefer minimal investment |
| D | Not interested in investing |

### Q5 - Timeline
| Code | Text |
|------|------|
| A | As soon as I find the right person |
| B | Within the next year |
| C | No specific timeline |
| D | Not sure yet |

---

## Environment Variables Needed

```env
# New CRM credentials (replace with actual variable names)
CRM_ACCESS_TOKEN=xxx
CRM_API_URL=xxx

# Existing (keep these)
CRON_SECRET=xxx  # For authenticating cron requests
```

---

## Files to Modify

1. **`src/app/api/quiz-submit/route.ts`**
   - Add `checkCrmCallStatus()` function
   - Add `sendToCrm()` function
   - Uncomment/add the CRM calls in the POST handler

2. **`src/app/api/cron/call-reminders/route.ts`**
   - Add `getContactsForReminder()` function to query new CRM
   - Restore the full cron logic (see git history for reference)

3. **`src/lib/quiz-helpers.ts`**
   - Already contains helper functions and type definitions
   - May need to add CRM-specific payload builder

---

## Previous Implementation Reference

The full HubSpot implementation was removed in commit `73e9035`. To see the previous code:

```bash
git show 2432b5c:src/app/api/quiz-submit/route.ts
git show 2432b5c:src/app/api/cron/call-reminders/route.ts
git show 2432b5c:src/lib/hubspot/payloads.ts
```

---

## Testing Checklist

When rewiring to new CRM:

- [ ] Quiz submission creates contact in CRM
- [ ] Duplicate email updates existing contact (doesn't error)
- [ ] "Call already scheduled" check works
- [ ] Cron job queries contacts correctly
- [ ] Cron job sends emails to right people
- [ ] Calendly booking updates call_status (if implemented)
