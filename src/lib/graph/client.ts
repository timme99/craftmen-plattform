import { Client } from "@microsoft/microsoft-graph-client";
import "isomorphic-fetch";

export function createGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

export async function sendInquiryEmail(
  accessToken: string,
  params: {
    from: string;
    to: string;
    subject: string;
    bodyHtml: string;
    attachments?: Array<{ name: string; contentBytes: string; contentType: string }>;
  }
) {
  const client = createGraphClient(accessToken);

  const message: Record<string, unknown> = {
    subject: params.subject,
    body: { contentType: "HTML", content: params.bodyHtml },
    toRecipients: [{ emailAddress: { address: params.to } }],
  };

  if (params.attachments?.length) {
    message.attachments = params.attachments.map((a) => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: a.name,
      contentBytes: a.contentBytes,
      contentType: a.contentType,
    }));
  }

  try {
    return await client.api("/me/sendMail").post({ message });
  } catch (err) {
    // Graph-Fehler in eine aussagekräftige Meldung übersetzen — sonst landet
    // im Log nur "body: ReadableStream" und der eigentliche Grund (z. B. 401)
    // bleibt unsichtbar.
    throw new Error(describeGraphError(err));
  }
}

/**
 * Baut aus einem Microsoft-Graph-Fehler eine lesbare Meldung
 * (Statuscode + Fehlercode + Text), ohne Tokens o. Ä. preiszugeben.
 */
function describeGraphError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as {
      statusCode?: number;
      code?: string | null;
      message?: string;
      requestId?: string | null;
      body?: unknown;
    };
    const parts: string[] = [];
    if (typeof e.statusCode === "number") parts.push(`HTTP ${e.statusCode}`);
    if (e.code) parts.push(String(e.code));
    if (typeof e.message === "string" && e.message.trim()) parts.push(e.message.trim());
    if (typeof e.body === "string" && e.body.trim()) parts.push(e.body.trim().slice(0, 300));
    if (parts.length > 0) return `E-Mail-Versand fehlgeschlagen: ${parts.join(" – ")}`;
  }
  return `E-Mail-Versand fehlgeschlagen: ${String(err)}`;
}

export async function getInboxMessages(
  accessToken: string,
  userEmail: string,
  filter?: string
) {
  const client = createGraphClient(accessToken);
  let query = client
    .api(`/users/${userEmail}/messages`)
    .select("id,subject,from,receivedDateTime,hasAttachments,bodyPreview")
    .orderby("receivedDateTime DESC")
    .top(50);

  if (filter) query = query.filter(filter);

  return query.get();
}

export async function getMessageAttachments(
  accessToken: string,
  userEmail: string,
  messageId: string
) {
  const client = createGraphClient(accessToken);
  return client
    .api(`/users/${userEmail}/messages/${messageId}/attachments`)
    .get();
}
