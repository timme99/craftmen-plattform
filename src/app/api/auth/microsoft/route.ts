import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { createOauthState } from "@/lib/security";

const OAUTH_STATE_COOKIE = "ms_oauth_state";

export async function GET() {
  try {
    await requireTenant();

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const tenantId = process.env.MICROSOFT_TENANT_ID ?? "common";
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")}/api/auth/microsoft/callback`;

    if (!clientId) {
      return NextResponse.json({ error: "Microsoft OAuth nicht konfiguriert" }, { status: 500 });
    }

    const scopes = ["offline_access", "Mail.ReadWrite", "Mail.Send", "User.Read"].join(" ");

    const state = createOauthState();
    const url = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", scopes);
    url.searchParams.set("response_mode", "query");
    url.searchParams.set("state", state);
    // Immer die Kontoauswahl zeigen: Bei "common" existiert dieselbe Adresse
    // ggf. als privates UND als geschäftliches/Organisations-Konto. Ohne diesen
    // Parameter würde eine still wiederverwendete Session das falsche (evtl.
    // postfachlose) Konto verbinden.
    url.searchParams.set("prompt", "select_account");

    const response = NextResponse.redirect(url.toString());
    response.cookies.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 10,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}
