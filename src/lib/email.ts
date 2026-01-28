import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// NOTE: Change to "AILO <hello@ailoapp.com>" once domain is verified in Resend dashboard
// For testing, use Resend's test domain: onboarding@resend.dev
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "AILO <onboarding@resend.dev>";

export async function sendBookingConfirmation(to: string, name: string) {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: "Your AILO Call is Confirmed",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #1a2328; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background-color: #2d3a40; border-radius: 16px; padding: 40px; border: 1px solid rgba(255,255,255,0.1);">
              <h1 style="color: #e1b98f; font-size: 28px; margin: 0 0 24px 0; font-weight: 600;">
                You're All Set, ${name}!
              </h1>
              <p style="color: #ebebeb; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Your discovery call with AILO has been confirmed. We're excited to learn more about what you're looking for and explore whether we can help you find your ideal match.
              </p>
              <p style="color: rgba(235,235,235,0.7); font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                Check your calendar for the meeting details. If you need to reschedule, you can do so through the calendar invite.
              </p>
              <div style="background-color: rgba(225,185,143,0.1); border-radius: 8px; padding: 20px; margin: 24px 0;">
                <p style="color: #e1b98f; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">
                  Before your call:
                </p>
                <ul style="color: rgba(235,235,235,0.8); font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li>Think about what qualities matter most to you in a partner</li>
                  <li>Consider your relationship goals and timeline</li>
                  <li>Prepare any questions you have about the AILO process</li>
                </ul>
              </div>
              <p style="color: rgba(235,235,235,0.5); font-size: 13px; margin: 24px 0 0 0;">
                See you soon,<br>
                <span style="color: #e1b98f;">The AILO Team</span>
              </p>
            </div>
            <p style="color: rgba(235,235,235,0.3); font-size: 12px; text-align: center; margin-top: 24px;">
              AILO - Where Science Meets the Heart
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error("Failed to send booking confirmation:", error);
    throw error;
  }

  return data;
}

export async function sendWaitlistConfirmation(to: string, city?: string) {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: "You're on the AILO Waitlist",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #1a2328; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background-color: #2d3a40; border-radius: 16px; padding: 40px; border: 1px solid rgba(255,255,255,0.1);">
              <h1 style="color: #e1b98f; font-size: 28px; margin: 0 0 24px 0; font-weight: 600;">
                You're on the List!
              </h1>
              <p style="color: #ebebeb; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Thanks for your interest in AILO. We've added you to our waitlist${city ? ` for ${city}` : ""} and will notify you as soon as we're ready to accept new members in your area.
              </p>
              <p style="color: rgba(235,235,235,0.7); font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                AILO is currently focused on couples-only matchmaking, where both partners meet our high compatibility standards. We're expanding thoughtfully to ensure every match has the best chance of success.
              </p>
              <div style="background-color: rgba(225,185,143,0.1); border-radius: 8px; padding: 20px; margin: 24px 0;">
                <p style="color: #e1b98f; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">
                  What happens next?
                </p>
                <ul style="color: rgba(235,235,235,0.8); font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li>We'll email you when we expand to your area</li>
                  <li>Priority access for waitlist members</li>
                  <li>No spam, just important updates</li>
                </ul>
              </div>
              <p style="color: rgba(235,235,235,0.5); font-size: 13px; margin: 24px 0 0 0;">
                Thank you for your patience,<br>
                <span style="color: #e1b98f;">The AILO Team</span>
              </p>
            </div>
            <p style="color: rgba(235,235,235,0.3); font-size: 12px; text-align: center; margin-top: 24px;">
              AILO - Where Science Meets the Heart
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error("Failed to send waitlist confirmation:", error);
    throw error;
  }

  return data;
}

export async function sendWeeklyInsightsConfirmation(to: string) {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: "Welcome to AILO Weekly Insights",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #1a2328; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background-color: #2d3a40; border-radius: 16px; padding: 40px; border: 1px solid rgba(255,255,255,0.1);">
              <h1 style="color: #e1b98f; font-size: 28px; margin: 0 0 24px 0; font-weight: 600;">
                Welcome to Weekly Insights!
              </h1>
              <p style="color: #ebebeb; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                You're now subscribed to AILO's Weekly Insights. Every week, you'll receive science-backed tips on relationships, compatibility, and personal growth.
              </p>
              <div style="background-color: rgba(225,185,143,0.1); border-radius: 8px; padding: 20px; margin: 24px 0;">
                <p style="color: #e1b98f; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">
                  What to expect:
                </p>
                <ul style="color: rgba(235,235,235,0.8); font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li>Evidence-based relationship advice</li>
                  <li>Self-reflection exercises</li>
                  <li>Insights from 30+ years of compatibility research</li>
                  <li>Tips for becoming your best self</li>
                </ul>
              </div>
              <p style="color: rgba(235,235,235,0.7); font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                When you feel ready to take the next step in your relationship journey, we'll be here.
              </p>
              <p style="color: rgba(235,235,235,0.5); font-size: 13px; margin: 24px 0 0 0;">
                To your growth,<br>
                <span style="color: #e1b98f;">The AILO Team</span>
              </p>
            </div>
            <p style="color: rgba(235,235,235,0.3); font-size: 12px; text-align: center; margin-top: 24px;">
              AILO - Where Science Meets the Heart
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error("Failed to send weekly insights confirmation:", error);
    throw error;
  }

  return data;
}

// Call reminder emails for qualified users who haven't booked
const BOOK_CALL_URL = process.env.NEXT_PUBLIC_SITE_URL
  ? `${process.env.NEXT_PUBLIC_SITE_URL}/book-call`
  : "https://ailoapp.com/book-call";

export async function sendCallReminder(
  to: string,
  name: string,
  reminderNumber: 1 | 2 | 3
) {
  const templates = {
    1: {
      subject: "Ready to find your match?",
      heading: "Still Thinking About It?",
      message: `We noticed you haven't booked your discovery call yet. This quick 15-minute chat is the first step toward finding a truly compatible partner.`,
      cta: "Book Your Free Call",
    },
    2: {
      subject: "Your perfect match could be waiting",
      heading: "Don't Miss Your Chance",
      message: `Finding the right partner shouldn't be left to chance. Our science-backed approach has helped countless singles find lasting love. Let's talk about what you're looking for.`,
      cta: "Schedule Now",
    },
    3: {
      subject: "Last chance: Let's find your match",
      heading: "We're Still Here For You",
      message: `Life gets busy, we understand. But if finding a meaningful relationship is still on your mind, we'd love to help. This is our final reminder—take the first step today.`,
      cta: "Book Your Call",
    },
  };

  const template = templates[reminderNumber];

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: template.subject,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #1a2328; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background-color: #2d3a40; border-radius: 16px; padding: 40px; border: 1px solid rgba(255,255,255,0.1);">
              <h1 style="color: #e1b98f; font-size: 28px; margin: 0 0 24px 0; font-weight: 600;">
                ${template.heading}
              </h1>
              <p style="color: #ebebeb; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hi ${name},
              </p>
              <p style="color: rgba(235,235,235,0.8); font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                ${template.message}
              </p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${BOOK_CALL_URL}" style="display: inline-block; background-color: #e1b98f; color: #1a2328; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  ${template.cta}
                </a>
              </div>
              <div style="background-color: rgba(225,185,143,0.1); border-radius: 8px; padding: 20px; margin: 24px 0;">
                <p style="color: #e1b98f; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">
                  Why AILO?
                </p>
                <ul style="color: rgba(235,235,235,0.8); font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li>30+ years of compatibility research</li>
                  <li>Only 70%+ compatibility matches</li>
                  <li>Personalized matchmaking, not algorithms</li>
                </ul>
              </div>
              <p style="color: rgba(235,235,235,0.5); font-size: 13px; margin: 24px 0 0 0;">
                Looking forward to meeting you,<br>
                <span style="color: #e1b98f;">The AILO Team</span>
              </p>
            </div>
            <p style="color: rgba(235,235,235,0.3); font-size: 12px; text-align: center; margin-top: 24px;">
              AILO - Where Science Meets the Heart
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error(`Failed to send call reminder #${reminderNumber}:`, error);
    throw error;
  }

  return data;
}
