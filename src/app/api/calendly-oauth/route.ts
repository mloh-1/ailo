import { NextRequest, NextResponse } from "next/server";
import { getAuthorizationUrl, exchangeCodeForTokens } from "@/lib/calendly-oauth";

/**
 * GET /api/calendly-oauth
 * Redirects to Calendly authorization page for initial OAuth setup
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");

  // If we have a code, exchange it for tokens
  if (code) {
    try {
      const tokens = await exchangeCodeForTokens(code);

      // Display the refresh token to be saved in env vars
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Calendly OAuth Setup Complete</title>
            <style>
              body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }
              .token-box { background: #f5f5f5; padding: 15px; border-radius: 8px; word-break: break-all; margin: 10px 0; }
              .warning { color: #d63031; font-weight: bold; }
              code { background: #e0e0e0; padding: 2px 6px; border-radius: 4px; }
            </style>
          </head>
          <body>
            <h1>✅ Calendly OAuth Setup Complete</h1>
            <p class="warning">⚠️ Save the refresh token below in your Vercel environment variables, then close this page.</p>

            <h3>Add this to Vercel:</h3>
            <p><code>CALENDLY_REFRESH_TOKEN</code></p>
            <div class="token-box">${tokens.refresh_token}</div>

            <h3>Access Token (for reference only - auto-refreshes):</h3>
            <div class="token-box" style="font-size: 12px;">${tokens.access_token}</div>

            <p><strong>Owner:</strong> ${tokens.owner}</p>
            <p><strong>Organization:</strong> ${tokens.organization}</p>
            <p><strong>Expires in:</strong> ${tokens.expires_in} seconds</p>

            <hr>
            <p>After adding <code>CALENDLY_REFRESH_TOKEN</code> to Vercel, redeploy and your Calendly integration will work.</p>
          </body>
        </html>
        `,
        {
          headers: { "Content-Type": "text/html" },
        }
      );
    } catch (error) {
      return NextResponse.json(
        { error: "Token exchange failed", details: String(error) },
        { status: 500 }
      );
    }
  }

  // No code - redirect to Calendly authorization
  const authUrl = getAuthorizationUrl();
  return NextResponse.redirect(authUrl);
}
