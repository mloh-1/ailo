// Calendly OAuth2 Helper

const CALENDLY_AUTH_BASE = "https://auth.calendly.com";
const CALENDLY_API_BASE = "https://api.calendly.com";

const CLIENT_ID = process.env.CALENDLY_CLIENT_ID;
const CLIENT_SECRET = process.env.CALENDLY_CLIENT_SECRET;
const REDIRECT_URI = process.env.CALENDLY_REDIRECT_URI || "https://localhost:3000/api/calendly-callback";

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  created_at: number;
  owner: string;
  organization: string;
}

// In-memory token cache (for serverless, we refresh every request)
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

/**
 * Get the authorization URL for initial OAuth setup
 */
export function getAuthorizationUrl(): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID || "",
    response_type: "code",
    redirect_uri: REDIRECT_URI,
  });

  return `${CALENDLY_AUTH_BASE}/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens (one-time use during setup)
 */
export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const response = await fetch(`${CALENDLY_AUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID || "",
      client_secret: CLIENT_SECRET || "",
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const response = await fetch(`${CALENDLY_AUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID || "",
      client_secret: CLIENT_SECRET || "",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  return response.json();
}

/**
 * Get a valid access token (refreshes if needed)
 */
export async function getAccessToken(): Promise<string> {
  const refreshToken = process.env.CALENDLY_REFRESH_TOKEN;

  if (!refreshToken) {
    throw new Error("CALENDLY_REFRESH_TOKEN not configured. Run OAuth setup first.");
  }

  // Check if we have a valid cached token
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.accessToken;
  }

  // Refresh the token
  const tokenResponse = await refreshAccessToken(refreshToken);

  // Cache the new token
  cachedToken = {
    accessToken: tokenResponse.access_token,
    expiresAt: Date.now() + tokenResponse.expires_in * 1000,
  };

  return tokenResponse.access_token;
}

/**
 * Make an authenticated request to Calendly API
 */
export async function calendlyFetch(endpoint: string): Promise<unknown> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${CALENDLY_API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Calendly API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const webhookSigningKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;

  if (!webhookSigningKey) {
    console.warn("CALENDLY_WEBHOOK_SIGNING_KEY not configured");
    return false;
  }

  // Calendly uses HMAC SHA256 for webhook signatures
  // The signature header format is: t=timestamp,v1=signature
  const crypto = require("crypto");

  const parts = signature.split(",");
  const timestamp = parts.find((p: string) => p.startsWith("t="))?.slice(2);
  const v1Signature = parts.find((p: string) => p.startsWith("v1="))?.slice(3);

  if (!timestamp || !v1Signature) {
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac("sha256", webhookSigningKey)
    .update(signedPayload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(v1Signature),
    Buffer.from(expectedSignature)
  );
}
