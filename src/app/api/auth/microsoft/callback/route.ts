import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import { safeEqualString } from "@/lib/security";

const OAUTH_STATE_COOKIE = "ms_oauth_state";
const OAUTH_TENANT_COOKIE = "ms_oauth_tenant";

export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

  // Redirect-Antwort, die beide OAuth-Cookies aufräumt.
  const redirectClearing = (path: string) => {
    const response = NextResponse.redirect(`${baseUrl}${path}`);
    response.cookies.delete(OAUTH_STATE_COOKIE);
    response.cookies.delete(OAUTH_TENANT_COOKIE);
    return response;
  };

  // Outside try/catch so Next.js redirect() errors propagate correctly
  const user = await requireTenant();

  try {
    const { searchParams } = req.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const stateCookie = req.cookies.get(OAUTH_STATE_COOKIE)?.value;

    if (!state || !stateCookie || !safeEqualString(state, stateCookie)) {
      return redirectClearing("/settings?error=invalid_state");
    }

    if (!code) {
      return redirectClearing("/settings?error=no_code");
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID!;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET!;
    // Denselben Login-Endpunkt wie beim Authorize-Schritt verwenden (privat →
    // consumers, geschäftlich → organizations), sonst schlägt der Token-Tausch
    // fehl. Fallback auf die Env-/Common-Konfiguration für Altaufrufe.
    const tenantId =
      req.cookies.get(OAUTH_TENANT_COOKIE)?.value ??
      process.env.MICROSOFT_TENANT_ID ??
      "common";
    const redirectUri = `${baseUrl}/api/auth/microsoft/callback`;

    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      }
    );

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("[microsoft/callback] token exchange failed:", tokenRes.status, errBody);
      return redirectClearing("/settings?error=token_exchange");
    }

    const tokens = await tokenRes.json();

    const profileRes = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = profileRes.ok ? await profileRes.json() : null;

    // Nur Konten mit echtem Postfach können senden. Eine mailbox-lose
    // Organisations-/Gast-Identität (#EXT# im UPN) hat kein nutzbares Postfach
    // und würde beim Senden still mit 401 scheitern. Solche Verbindungen gar
    // nicht erst speichern, sondern klar auf das richtige Konto hinweisen.
    const rawEmail = profile?.mail ?? profile?.userPrincipalName ?? null;
    const emailAddress = rawEmail && !rawEmail.includes("#EXT#") ? rawEmail : null;
    if (!emailAddress) {
      return redirectClearing("/settings?error=no_mailbox");
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.emailConnection.upsert({
      where: { tenantId: user.tenantId },
      create: {
        tenantId: user.tenantId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        tokenExpiresAt: expiresAt,
        emailAddress,
        isActive: true,
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        tokenExpiresAt: expiresAt,
        emailAddress,
        isActive: true,
      },
    });

    return redirectClearing("/settings?success=connected");
  } catch (err) {
    console.error("[microsoft/callback] error:", err);
    return redirectClearing("/settings?error=unknown");
  }
}
