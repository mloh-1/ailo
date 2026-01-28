import { NextRequest, NextResponse } from "next/server";
import { sendCallReminder } from "@/lib/email";

const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET;

// Reminder schedule in days after quiz submission
const REMINDER_DAYS = [2, 4, 9] as const;

// Parallel email sending configuration
const BATCH_SIZE = 10; // Send 10 emails in parallel
const MAX_CONTACTS_PER_REMINDER = 500; // Safety limit

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
  paging?: {
    next?: {
      after: string;
    };
  };
}

function getDateRange(days: number): { start: number; end: number } {
  const startDate = new Date();
  startDate.setUTCHours(0, 0, 0, 0);
  startDate.setUTCDate(startDate.getUTCDate() - days);

  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 1);

  return { start: startDate.getTime(), end: endDate.getTime() };
}

async function getContactsForReminder(dayNumber: number): Promise<HubSpotContact[]> {
  if (!HUBSPOT_ACCESS_TOKEN) {
    console.error("HUBSPOT_ACCESS_TOKEN not configured");
    return [];
  }

  const { start, end } = getDateRange(dayNumber);
  const allContacts: HubSpotContact[] = [];
  let after: string | undefined = undefined;

  console.log(`Querying for day ${dayNumber}: createdate between ${new Date(start).toISOString()} and ${new Date(end).toISOString()}`);

  try {
    // Paginate through all results
    do {
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
                    value: start.toString(),
                  },
                  {
                    propertyName: "createdate",
                    operator: "LT",
                    value: end.toString(),
                  },
                ],
              },
            ],
            properties: ["firstname", "email", "createdate", "quiz_outcome", "call_status"],
            limit: 100,
            ...(after && { after }),
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HubSpot search failed for day ${dayNumber}:`, errorText);
        break;
      }

      const data: HubSpotSearchResponse = await response.json();
      allContacts.push(...data.results);

      after = data.paging?.next?.after;

      // Safety limit to prevent runaway queries
      if (allContacts.length >= MAX_CONTACTS_PER_REMINDER) {
        console.warn(`Hit max contacts limit (${MAX_CONTACTS_PER_REMINDER}) for day ${dayNumber}`);
        break;
      }
    } while (after);

    console.log(`Found ${allContacts.length} contacts for day ${dayNumber} reminder`);
    return allContacts;
  } catch (error) {
    console.error(`Error fetching contacts for day ${dayNumber}:`, error);
    return [];
  }
}

// Send emails in parallel batches
async function sendEmailBatch(
  contacts: HubSpotContact[],
  reminderNumber: 1 | 2 | 3
): Promise<{ sent: number; failed: number; emails: string[] }> {
  const results = { sent: 0, failed: 0, emails: [] as string[] };

  // Process in batches
  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE);

    const promises = batch.map(async (contact) => {
      const email = contact.properties.email;
      const name = contact.properties.firstname || "there";

      if (!email) {
        console.warn(`Contact ${contact.id} has no email, skipping`);
        return { success: false, email: null };
      }

      try {
        await sendCallReminder(email, name, reminderNumber);
        console.log(`Sent reminder #${reminderNumber} to ${email}`);
        return { success: true, email };
      } catch (error) {
        console.error(`Failed to send reminder #${reminderNumber} to ${email}:`, error);
        return { success: false, email };
      }
    });

    const batchResults = await Promise.all(promises);

    for (const result of batchResults) {
      if (result.success && result.email) {
        results.sent++;
        results.emails.push(result.email);
      } else if (result.email) {
        results.failed++;
      }
    }
  }

  return results;
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

  // Process each reminder day in parallel
  const reminderPromises = REMINDER_DAYS.map(async (dayNumber, i) => {
    const reminderNumber = (i + 1) as 1 | 2 | 3;
    console.log(`Processing reminder #${reminderNumber} (day ${dayNumber})...`);

    const contacts = await getContactsForReminder(dayNumber);

    if (contacts.length === 0) {
      return { reminderNumber, sent: 0, failed: 0, emails: [] };
    }

    const emailResults = await sendEmailBatch(contacts, reminderNumber);
    return { reminderNumber, ...emailResults };
  });

  const reminderResults = await Promise.all(reminderPromises);

  // Aggregate results
  for (const result of reminderResults) {
    const key = `reminder${result.reminderNumber}` as keyof typeof results;
    results[key].sent = result.sent;
    results[key].failed = result.failed;
    results[key].contacts = result.emails;
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
