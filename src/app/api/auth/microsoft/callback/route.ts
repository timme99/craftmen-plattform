import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import { safeEqualString } from "@/lib/security";

const OAUTH_STATE_COOKIE = "ms_oauth_state";

export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

  // Outside try/catch so Next.js redirect() errors propagate correctly
  const user = await requireTenant();

  try {
    const { searchParams } = req.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const stateCookie = req.cookies.get(OAUTH_STATE_COOKIE)?.value;

    if (!state || !stateCookie || !safeEqualString(state, stateCookie)) {
      const response = NextResponse.redirect(`${baseUrl}/settings?error=invalid_state`);
      response.cookies.delete(OAUTH_STATE_COOKIE);
      return response;
    }

    if (!code) {
      const response = NextResponse.redirect(`${baseUrl}/settings?error=no_code`);
      response.cookies.delete(OAUTH_STATE_COOKIE);
      return response;
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID!;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET!;
    const tenantId = process.env.MICROSOFT_TENANT_ID ?? "common";
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
      const response = NextResponse.redirect(`${baseUrl}/settings?error=token_exchange`);
      response.cookies.delete(OAUTH_STATE_COOKIE);
      return response;
    }

    const tokens = await tokenRes.json();

    const profileRes = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = profileRes.ok ? await profileRes.json() : null;
    const emailAddress = profile?.mail ?? profile?.userPrincipalName ?? null;

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

    const response = NextResponse.redirect(`${baseUrl}/settings?success=connected`);
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  } catch (err) {
    console.error("[microsoft/callback] error:", err);
    const response = NextResponse.redirect(`${baseUrl}/settings?error=unknown`);
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  }
}
