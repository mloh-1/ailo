// Server-side reCAPTCHA verification

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

// Minimum score to accept (0.0 - 1.0, higher = more likely human)
// 0.3 is lenient to avoid blocking legitimate users with VPNs/privacy browsers
const MIN_SCORE = 0.3;

interface RecaptchaResponse {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
}

export async function verifyRecaptcha(token: string): Promise<{ success: boolean; score?: number; error?: string }> {
  if (!RECAPTCHA_SECRET_KEY) {
    console.warn("RECAPTCHA_SECRET_KEY not configured, skipping verification");
    return { success: true }; // Allow through if not configured
  }

  if (!token) {
    return { success: false, error: "No reCAPTCHA token provided" };
  }

  try {
    const response = await fetch(RECAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        secret: RECAPTCHA_SECRET_KEY,
        response: token,
      }),
    });

    const data: RecaptchaResponse = await response.json();

    console.log("reCAPTCHA response:", JSON.stringify(data));

    if (!data.success) {
      console.error("reCAPTCHA verification failed:", data["error-codes"]);
      console.error("Hostname:", data.hostname);
      return { success: false, error: `reCAPTCHA verification failed: ${data["error-codes"]?.join(", ") || "unknown error"}` };
    }

    // For reCAPTCHA v3, check the score
    if (data.score !== undefined && data.score < MIN_SCORE) {
      console.warn(`reCAPTCHA score too low: ${data.score}`);
      return { success: false, score: data.score, error: "Suspicious activity detected" };
    }

    return { success: true, score: data.score };
  } catch (error) {
    console.error("reCAPTCHA verification error:", error);
    return { success: false, error: "reCAPTCHA verification error" };
  }
}
