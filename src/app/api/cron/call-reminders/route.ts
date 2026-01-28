import { NextRequest, NextResponse } from "next/server";
import { sendCallReminder } from "@/lib/email";

const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET;

// Reminder schedule: Day 2, Day 4, Day 9 after quiz submission
const REMINDER_DAYS = [2, 4, 9] as const;

interface HubSpotContact {
  id: string;
  properties: {
    firstname?: string;
    email?: string;
    createdate?: string;
    quiz_outcome?: string;
    call_status?: string;
  };
}

interface HubSpotSearchResponse {
  total: number;
  results: HubSpotContact[];
}

function getDateDaysAgo(days: number): { start: string; end: string } {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);

  const start = date.toISOString().split("T")[0];

  date.setUTCDate(date.getUTCDate() + 1);
  const end = date.toISOString().split("T")[0];

  return { start, end };
}

async function getContactsForReminder(dayNumber: number): Promise<HubSpotContact[]> {
  if (!HUBSPOT_ACCESS_TOKEN) {
    console.error("HUBSPOT_ACCESS_TOKEN not configured");
    return [];
  }

  const { start, end } = getDateDaysAgo(dayNumber);

  try {
    const response = await fetch(
      "https://api.hubapi.com/crm/v3/objects/contacts/search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: "quiz_outcome",
                  operator: "EQ",
                  value: "Qualified",
                },
                {
                  propertyName: "call_status",
                  operator: "NEQ",
                  value: "Call Scheduled",
                },
                {
                  propertyName: "createdate",
                  operator: "GTE",
                  value: start,
                },
                {
                  propertyName: "createdate",
                  operator: "LT",
                  value: end,
                },
              ],
            },
          ],
          properties: ["firstname", "email", "createdate", "quiz_outcome", "call_status"],
          limit: 100,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HubSpot search failed for day ${dayNumber}:`, errorText);
      return [];
    }

    const data: HubSpotSearchResponse = await response.json();
    console.log(`Found ${data.total} contacts for day ${dayNumber} reminder`);
    return data.results;
  } catch (error) {
    console.error(`Error fetching contacts for day ${dayNumber}:`, error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = request.headers.get("x-cron-secret");

  // Support both header formats
  const providedSecret = cronSecret || authHeader?.replace("Bearer ", "");

  if (!CRON_SECRET) {
    console.error("CRON_SECRET not configured");
    return NextResponse.json(
      { error: "Cron not configured" },
      { status: 500 }
    );
  }

  if (providedSecret !== CRON_SECRET) {
    console.error("Invalid cron secret");
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  console.log("Starting call reminder cron job...");

  const results = {
    reminder1: { sent: 0, failed: 0, contacts: [] as string[] },
    reminder2: { sent: 0, failed: 0, contacts: [] as string[] },
    reminder3: { sent: 0, failed: 0, contacts: [] as string[] },
  };

  // Process each reminder day
  for (let i = 0; i < REMINDER_DAYS.length; i++) {
    const dayNumber = REMINDER_DAYS[i];
    const reminderNumber = (i + 1) as 1 | 2 | 3;
    const resultKey = `reminder${reminderNumber}` as keyof typeof results;

    console.log(`Processing reminder #${reminderNumber} (day ${dayNumber})...`);

    const contacts = await getContactsForReminder(dayNumber);

    for (const contact of contacts) {
      const email = contact.properties.email;
      const name = contact.properties.firstname || "there";

      if (!email) {
        console.warn(`Contact ${contact.id} has no email, skipping`);
        continue;
      }

      try {
        await sendCallReminder(email, name, reminderNumber);
        results[resultKey].sent++;
        results[resultKey].contacts.push(email);
        console.log(`Sent reminder #${reminderNumber} to ${email}`);
      } catch (error) {
        results[resultKey].failed++;
        console.error(`Failed to send reminder #${reminderNumber} to ${email}:`, error);
      }
    }
  }

  const summary = {
    success: true,
    timestamp: new Date().toISOString(),
    results: {
      reminder1_day2: results.reminder1,
      reminder2_day4: results.reminder2,
      reminder3_day9: results.reminder3,
    },
    totals: {
      sent: results.reminder1.sent + results.reminder2.sent + results.reminder3.sent,
      failed: results.reminder1.failed + results.reminder2.failed + results.reminder3.failed,
    },
  };

  console.log("Call reminder cron job completed:", JSON.stringify(summary, null, 2));

  return NextResponse.json(summary);
}
