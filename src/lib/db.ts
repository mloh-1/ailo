import { createClient } from "@libsql/client";

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export async function initializeDatabase() {
  // Quiz submissions table (for booked calls)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS quiz_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_uuid TEXT UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      email_calendly TEXT,
      phone TEXT NOT NULL,
      location TEXT,
      intent TEXT,
      availability TEXT,
      investment TEXT,
      timeline TEXT,
      outcome TEXT NOT NULL,
      lead_source TEXT DEFAULT 'website',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: Add new columns if they don't exist (for existing tables)
  const newColumns = ['name', 'location', 'intent', 'availability', 'investment', 'timeline', 'lead_source', 'booking_uuid', 'email_calendly'];
  for (const column of newColumns) {
    try {
      await db.execute(`ALTER TABLE quiz_submissions ADD COLUMN ${column} TEXT`);
    } catch {
      // Column already exists, ignore error
    }
  }

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_quiz_submissions_email
    ON quiz_submissions(email)
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_quiz_submissions_booking_uuid
    ON quiz_submissions(booking_uuid)
  `);

  // Waitlist subscribers table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS waitlist_subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      city TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_waitlist_email
    ON waitlist_subscribers(email)
  `);

  // Newsletter subscribers table (weekly insights)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      source TEXT DEFAULT 'not-ready',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_newsletter_email
    ON newsletter_subscribers(email)
  `);
}
