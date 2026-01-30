import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db, initializeDatabase } from "@/lib/db";
import { sendWaitlistConfirmation } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyRecaptcha } from "@/lib/recaptcha";
import { getLocationText, getFullAnswerText } from "@/lib/quiz-helpers";

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

// TODO: CRM integration removed - will be rewired to new CRM later
// Previous HubSpot integration included:
// - checkCrmCallStatus(email): Check if user already has a call scheduled
// - sendToCrm(data): Create/update contact with quiz data
// Contact properties needed: firstname, email, phone, location, intent,
// availability, investment, timeline, quiz_outcome, user_status,
// access_to_ailo_unlimited, call_status

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

    // TODO: Add CRM check for existing call scheduled when new CRM is wired
    // Previously checked HubSpot call_status === "Call Scheduled"

    console.log("Step 1: Initializing database...");
    await initializeDatabase();
    console.log("Step 1: Database initialized");

    // Generate unique booking UUID for linking quiz submission to Calendly booking
    const bookingUuid = randomUUID();

    // Save to Turso database with full answer text (using sanitized inputs)
    console.log("Step 2: Saving to Turso database...");
    await db.execute({
      sql: `
        INSERT INTO quiz_submissions (booking_uuid, name, email, phone, location, intent, availability, investment, timeline, outcome, lead_source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        bookingUuid,
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
    console.log("Step 2: Saved to Turso database with UUID:", bookingUuid);

    // TODO: Send to CRM when new CRM is wired
    // Previously sent: name, email, phone, answers (q1-q5), outcome

    // If waitlist outcome, also add to waitlist_subscribers and send confirmation email
    if (outcome === "waitlist") {
      console.log("Step 3: Processing waitlist...");
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
        console.log("Step 3a: Added to waitlist_subscribers");
      } catch (e) {
        console.log("Step 3a: Duplicate email, skipping waitlist insert");
      }

      // Send waitlist confirmation email (non-blocking - don't fail submission if email fails)
      console.log("Step 3b: Sending waitlist confirmation email...");
      try {
        await sendWaitlistConfirmation(sanitizedEmail, city);
        console.log("Step 3b: Sent waitlist confirmation email");
      } catch (emailError) {
        console.error("Step 3b: Failed to send waitlist email (non-blocking):", emailError);
      }
    }

    console.log("Quiz submission completed successfully");

    // Set booking UUID in HTTP-only cookie for the book-call page
    const response = NextResponse.json({ success: true, bookingUuid });
    response.cookies.set("booking_id", bookingUuid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Error saving quiz submission:", error);
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    console.error("Error stack:", error instanceof Error ? error.stack : "no stack");
    return NextResponse.json(
      { error: "Failed to save submission" },
      { status: 500 }
    );
  }
}
