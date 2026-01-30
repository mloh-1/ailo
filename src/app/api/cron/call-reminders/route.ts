import { NextRequest, NextResponse } from "next/server";

// TODO: CRM integration removed - will be rewired to new CRM later
//
// Previous HubSpot-based call reminder system:
// - Queried HubSpot for contacts where:
//   - quiz_outcome = "Qualified"
//   - call_status != "Call Scheduled"
//   - createdate within specific date range (days 2, 4, 9)
// - Used pagination (100 per page, up to 500 max)
// - Sent reminder emails in parallel batches of 10
// - Reminder schedule: Day 2, Day 4, Day 9 after quiz submission
//
// To re-enable with new CRM:
// 1. Implement getContactsForReminder() to query new CRM
// 2. Query for: outcome=qualified, no call scheduled, created X days ago
// 3. Use sendCallReminder() from @/lib/email for sending emails

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = request.headers.get("x-cron-secret");
  const providedSecret = cronSecret || authHeader?.replace("Bearer ", "");

  if (!CRON_SECRET || providedSecret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // CRM integration disabled
  return NextResponse.json({
    success: true,
    message: "Call reminder cron is disabled - CRM integration pending",
    timestamp: new Date().toISOString(),
  });
}
