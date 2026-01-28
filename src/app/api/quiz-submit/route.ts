import { NextRequest, NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { sendWaitlistConfirmation } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyRecaptcha } from "@/lib/recaptcha";
import {
  buildHubSpotContactPayload,
  getLocationText,
  getFullAnswerText,
  QuizSubmissionInput,
} from "@/lib/hubspot";

// Server-side validation helpers
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPhone(phone: string): boolean {
  // Allow digits, spaces, dashes, parentheses, plus sign - minimum 10 digits
  const digitsOnly = phone.replace(/\D/g, "");
  return digitsOnly.length >= 10;
}

function isValidOutcome(outcome: string): boolean {
  return ["qualified", "waitlist", "not-ready"].includes(outcome);
}

function isValidAnswer(answer: string): boolean {
  return ["A", "B", "C", "D"].includes(answer);
}

function sanitizeString(str: string): string {
  // Basic sanitization - trim and limit length
  return str.trim().slice(0, 500);
}

function isValidName(name: string): boolean {
  // Only allow letters, spaces, hyphens, apostrophes, and common accented characters
  // Minimum 2 characters, maximum 100
  const nameRegex = /^[a-zA-ZÀ-ÿ\s\-']{2,100}$/;
  return nameRegex.test(name.trim());
}

interface QuizSubmission {
  name: string;
  email: string;
  phone: string;
  answers: Record<string, string>;
  outcome: string;
  recaptchaToken?: string;
}

// Check if contact exists in HubSpot and has a call scheduled
async function checkHubSpotCallStatus(email: string): Promise<{ exists: boolean; callScheduled: boolean }> {
  const hubspotToken = process.env.HUBSPOT_ACCESS_TOKEN;

  if (!hubspotToken) {
    return { exists: false, callScheduled: false };
  }

  try {
    // Search for contact by email
    const searchResponse = await fetch(
      "https://api.hubapi.com/crm/v3/objects/contacts/search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${hubspotToken}`,
        },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: "email",
                  operator: "EQ",
                  value: email,
                },
              ],
            },
          ],
          properties: ["email", "call_status"],
        }),
      }
    );

    if (!searchResponse.ok) {
      console.error("HubSpot search error:", await searchResponse.text());
      return { exists: false, callScheduled: false };
    }

    const searchData = await searchResponse.json();

    if (searchData.total === 0) {
      return { exists: false, callScheduled: false };
    }

    const contact = searchData.results[0];
    const callStatus = contact.properties?.call_status;

    console.log("Found existing contact, call_status:", callStatus);

    return {
      exists: true,
      callScheduled: callStatus === "Call Scheduled",
    };
  } catch (error) {
    console.error("Error checking HubSpot call status:", error);
    return { exists: false, callScheduled: false };
  }
}

async function sendToHubSpot(data: QuizSubmission) {
  const hubspotToken = process.env.HUBSPOT_ACCESS_TOKEN;

  if (!hubspotToken) {
    console.warn("HUBSPOT_ACCESS_TOKEN not configured, skipping HubSpot sync");
    return;
  }

  // Build payload using DTO
  const input: QuizSubmissionInput = {
    name: data.name,
    email: data.email,
    phone: data.phone,
    answers: data.answers,
    outcome: data.outcome as "qualified" | "waitlist" | "not-ready",
  };

  const contactData = buildHubSpotContactPayload(input);

  try {
    console.log("Sending to HubSpot:", JSON.stringify(contactData, null, 2));

    // Try to create contact
    const createResponse = await fetch(
      "https://api.hubapi.com/crm/v3/objects/contacts",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${hubspotToken}`,
        },
        body: JSON.stringify(contactData),
      }
    );

    const responseText = await createResponse.text();
    console.log("HubSpot response status:", createResponse.status);
    console.log("HubSpot response:", responseText);

    // If contact exists (409 conflict), update instead
    if (createResponse.status === 409) {
      const errorData = JSON.parse(responseText);
      const existingContactId = errorData.message?.match(/Existing ID: (\d+)/)?.[1];

      if (existingContactId) {
        console.log("Contact exists, updating ID:", existingContactId);
        const updateResponse = await fetch(
          `https://api.hubapi.com/crm/v3/objects/contacts/${existingContactId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${hubspotToken}`,
            },
            body: JSON.stringify(contactData),
          }
        );
        console.log("HubSpot update status:", updateResponse.status);
      }
    } else if (!createResponse.ok) {
      console.error("HubSpot API error:", responseText);
    } else {
      console.log("HubSpot contact created successfully");
    }
  } catch (error) {
    console.error("Error sending to HubSpot:", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ||
               request.headers.get("x-real-ip") ||
               "unknown";
    const rateLimitResult = checkRateLimit(ip);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body: QuizSubmission = await request.json();

    const { name, email, phone, answers, outcome, recaptchaToken } = body;

    // Verify reCAPTCHA
    console.log("reCAPTCHA token received:", recaptchaToken ? `${recaptchaToken.substring(0, 20)}...` : "NONE");
    const recaptchaResult = await verifyRecaptcha(recaptchaToken || "");
    if (!recaptchaResult.success) {
      return NextResponse.json(
        { error: recaptchaResult.error || "reCAPTCHA verification failed" },
        { status: 400 }
      );
    }

    // Basic field presence check
    if (!name || !email || !phone || !answers || !outcome) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Server-side validation
    if (!isValidName(name)) {
      return NextResponse.json(
        { error: "Invalid name. Please use only letters, spaces, and hyphens." },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json(
        { error: "Invalid phone number" },
        { status: 400 }
      );
    }

    if (!isValidOutcome(outcome)) {
      return NextResponse.json(
        { error: "Invalid outcome" },
        { status: 400 }
      );
    }

    // Validate answers
    for (const [key, value] of Object.entries(answers)) {
      if (!["q1", "q2", "q3", "q4", "q5"].includes(key) || !isValidAnswer(value)) {
        return NextResponse.json(
          { error: "Invalid quiz answers" },
          { status: 400 }
        );
      }
    }

    // Sanitize inputs
    const sanitizedName = sanitizeString(name);
    const sanitizedEmail = sanitizeString(email).toLowerCase();
    const sanitizedPhone = sanitizeString(phone);

    // Check if contact already has a call scheduled in HubSpot
    const hubspotStatus = await checkHubSpotCallStatus(sanitizedEmail);
    if (hubspotStatus.callScheduled) {
      return NextResponse.json(
        { error: "call_already_scheduled", message: "You already have a call scheduled with us!" },
        { status: 409 }
      );
    }

    await initializeDatabase();

    // Save to Turso database with full answer text (using sanitized inputs)
    await db.execute({
      sql: `
        INSERT INTO quiz_submissions (name, email, phone, location, intent, availability, investment, timeline, outcome, lead_source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        sanitizedName,
        sanitizedEmail,
        sanitizedPhone,
        getLocationText(answers.q1 || ""),
        getFullAnswerText("q2", answers.q2 || ""),
        getFullAnswerText("q3", answers.q3 || ""),
        getFullAnswerText("q4", answers.q4 || ""),
        getFullAnswerText("q5", answers.q5 || ""),
        outcome,
        "website",
      ],
    });

    // Send to HubSpot (with sanitized data)
    await sendToHubSpot({
      name: sanitizedName,
      email: sanitizedEmail,
      phone: sanitizedPhone,
      answers,
      outcome,
    });

    // If waitlist outcome, also add to waitlist_subscribers and send confirmation email
    if (outcome === "waitlist") {
      // Get city from Q1 answer for waitlist record
      const locationMap: Record<string, string> = {
        B: "Florida (outside South Florida)",
        C: "U.S. (outside Florida)",
        D: "Outside the U.S.",
      };
      const city = locationMap[answers.q1] || "Unknown";

      // Add to waitlist_subscribers (ignore if already exists)
      try {
        await db.execute({
          sql: `INSERT INTO waitlist_subscribers (email, city) VALUES (?, ?)`,
          args: [sanitizedEmail, city],
        });
      } catch {
        // Ignore duplicate email error
      }

      // Send waitlist confirmation email
      await sendWaitlistConfirmation(sanitizedEmail, city);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving quiz submission:", error);
    return NextResponse.json(
      { error: "Failed to save submission" },
      { status: 500 }
    );
  }
}
