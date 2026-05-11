import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";

export async function GET() {
  try {
    await requireTenant();

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const tenantId = process.env.MICROSOFT_TENANT_ID ?? "common";
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/microsoft/callback`;

    if (!clientId) {
      return NextResponse.json({ error: "Microsoft OAuth nicht konfiguriert" }, { status: 500 });
    }

    const scopes = [
      "offline_access",
      "Mail.ReadWrite",
      "Mail.Send",
      "User.Read",
    ].join(" ");

    const url = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", scopes);
    url.searchParams.set("response_mode", "query");

    return NextResponse.redirect(url.toString());
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}
