import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { createOauthState } from "@/lib/security";

const OAUTH_STATE_COOKIE = "ms_oauth_state";
const OAUTH_TENANT_COOKIE = "ms_oauth_tenant";

/**
 * Bestimmt den Microsoft-Login-Endpunkt aus dem gewählten Kontotyp.
 * Ein fester Endpunkt verhindert, dass eine doppelt existierende Adresse
 * (privat UND Organisation) versehentlich auf dem falschen, postfachlosen
 * Konto landet:
 *  - "personal" → consumers   (nur private Microsoft-Konten, z. B. outlook.com)
 *  - "work"     → organizations (nur Firmen-/Microsoft-365-Konten)
 *  - sonst      → common       (Rückwärtskompatibilität für Altaufrufe)
 */
function resolveLoginTenant(type: string | null): string {
  if (type === "personal") return "consumers";
  if (type === "work") return "organizations";
  return process.env.MICROSOFT_TENANT_ID ?? "common";
}

export async function GET(req: NextRequest) {
  try {
    await requireTenant();

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")}/api/auth/microsoft/callback`;

    if (!clientId) {
      return NextResponse.json({ error: "Microsoft OAuth nicht konfiguriert" }, { status: 500 });
    }

    const loginTenant = resolveLoginTenant(req.nextUrl.searchParams.get("type"));
    const scopes = ["offline_access", "Mail.ReadWrite", "Mail.Send", "User.Read"].join(" ");

    const state = createOauthState();
    const url = new URL(`https://login.microsoftonline.com/${loginTenant}/oauth2/v2.0/authorize`);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", scopes);
    url.searchParams.set("response_mode", "query");
    url.searchParams.set("state", state);
    // Zusätzlicher Schutz: immer die Kontoauswahl zeigen, damit keine still
    // wiederverwendete Session ein unerwartetes Konto verbindet.
    url.searchParams.set("prompt", "select_account");

    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      maxAge: 60 * 10,
      path: "/",
    };

    const response = NextResponse.redirect(url.toString());
    response.cookies.set(OAUTH_STATE_COOKIE, state, cookieOptions);
    // Der Callback muss denselben Endpunkt für den Token-Tausch verwenden.
    response.cookies.set(OAUTH_TENANT_COOKIE, loginTenant, cookieOptions);

    return response;
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}
