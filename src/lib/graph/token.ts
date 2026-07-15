import { prisma } from "@/lib/prisma/client";
import type { EmailConnection } from "@prisma/client";

// Puffer, damit ein Token nicht mitten im Versand abläuft
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export interface GraphAccess {
  accessToken: string;
  emailAddress: string;
}

/**
 * Liefert einen gültigen Microsoft-Graph-Access-Token für den Tenant.
 * Abgelaufene Tokens werden über den gespeicherten Refresh-Token erneuert
 * und persistiert. Gibt null zurück, wenn keine nutzbare Verbindung
 * existiert (nicht verbunden, deaktiviert oder Refresh fehlgeschlagen) —
 * Aufrufer behandeln das wie "kein E-Mail-Konto verbunden".
 */
export async function getGraphAccess(tenantId: string): Promise<GraphAccess | null> {
  const conn = await prisma.emailConnection.findUnique({ where: { tenantId } });
  if (!conn?.accessToken || !conn.emailAddress || !conn.isActive) return null;

  const isExpired =
    conn.tokenExpiresAt != null &&
    conn.tokenExpiresAt.getTime() - EXPIRY_BUFFER_MS <= Date.now();

  if (!isExpired) {
    return { accessToken: conn.accessToken, emailAddress: conn.emailAddress };
  }

  if (!conn.refreshToken) return null;
  return refreshGraphTokens(conn);
}

async function refreshGraphTokens(conn: EmailConnection): Promise<GraphAccess | null> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const oauthTenant = process.env.MICROSOFT_TENANT_ID ?? "common";

  const res = await fetch(
    `https://login.microsoftonline.com/${oauthTenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: conn.refreshToken!,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    }
  );

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("[graph/token] refresh failed:", res.status, errBody.slice(0, 500));
    // invalid_grant o.ä. — Verbindung ist tot, Nutzer muss neu verbinden
    if (res.status === 400 || res.status === 401) {
      await prisma.emailConnection
        .update({ where: { id: conn.id }, data: { isActive: false } })
        .catch(() => {});
    }
    return null;
  }

  const tokens = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  await prisma.emailConnection.update({
    where: { id: conn.id },
    data: {
      accessToken: tokens.access_token,
      // Microsoft rotiert Refresh-Tokens; alten behalten, falls keiner mitkommt
      refreshToken: tokens.refresh_token ?? conn.refreshToken,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      isActive: true,
    },
  });

  return { accessToken: tokens.access_token, emailAddress: conn.emailAddress! };
}
