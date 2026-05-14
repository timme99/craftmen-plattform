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

  return client.api("/me/sendMail").post({ message });
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
