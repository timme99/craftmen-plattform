import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import { getInboxMessages, getMessageAttachments } from "@/lib/graph/client";

export async function POST() {
  try {
    const user = await requireTenant();

    const emailConn = await prisma.emailConnection.findUnique({
      where: { tenantId: user.tenantId },
    });

    if (!emailConn?.accessToken || !emailConn.emailAddress) {
      return NextResponse.json(
        { error: "Kein E-Mail-Konto verbunden. Bitte unter Einstellungen konfigurieren." },
        { status: 400 }
      );
    }

    const openInquiries = await prisma.inquiry.findMany({
      where: { tenantId: user.tenantId, status: { in: ["SENT", "OPENED"] } },
      include: { supplier: true, project: true },
    });

    if (openInquiries.length === 0) {
      return NextResponse.json({ message: "Keine offenen Anfragen.", processed: 0 });
    }

    const supplierEmailMap = new Map(
      openInquiries.map((inq) => [inq.supplier.email.toLowerCase(), inq])
    );

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const filter = `hasAttachments eq true and receivedDateTime ge ${since.toISOString()}`;

    const messagesResult = await getInboxMessages(
      emailConn.accessToken,
      emailConn.emailAddress,
      filter
    );

    const messages: Array<{
      id: string;
      subject: string;
      from: { emailAddress: { address: string } };
      receivedDateTime: string;
    }> = messagesResult?.value ?? [];

    let processed = 0;
    const results: Array<{ supplier: string; status: string; attachments: number }> = [];

    for (const msg of messages) {
      const senderEmail = msg.from?.emailAddress?.address?.toLowerCase();
      if (!senderEmail) continue;

      const inquiry = supplierEmailMap.get(senderEmail);
      if (!inquiry) continue;

      const attachmentsResult = await getMessageAttachments(
        emailConn.accessToken,
        emailConn.emailAddress,
        msg.id
      );
      const attachments: Array<{ name: string; contentBytes: string; contentType: string }> =
        attachmentsResult?.value ?? [];

      const pdfAttachments = attachments.filter(
        (a) => a.contentType === "application/pdf" || a.name?.toLowerCase().endsWith(".pdf")
      );

      if (pdfAttachments.length === 0) continue;

      const pdfServiceUrl = process.env.PDF_SERVICE_URL;
      if (pdfServiceUrl) {
        for (const pdf of pdfAttachments) {
          const lvList = await prisma.leistungsverzeichnis.findFirst({
            where: { projectId: inquiry.projectId },
          });
          if (lvList) {
            try {
              await fetch(`${pdfServiceUrl}/extract-from-base64`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-Service-Secret": process.env.PDF_SERVICE_SECRET ?? "",
                },
                body: JSON.stringify({
                  inquiryId: inquiry.id,
                  fileName: pdf.name,
                  contentBase64: pdf.contentBytes,
                  callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/email-scanner/offer-callback`,
                }),
              });
            } catch {
              // Non-blocking
            }
          }
        }
      }

      await prisma.inquiry.update({
        where: { id: inquiry.id },
        data: { status: "OFFER_RECEIVED", emailMessageId: msg.id },
      });

      processed++;
      results.push({ supplier: inquiry.supplier.companyName, status: "verarbeitet", attachments: pdfAttachments.length });
    }

    return NextResponse.json({
      message: `Scan abgeschlossen. ${processed} neue Angebote gefunden.`,
      processed,
      results,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Scanner fehlgeschlagen" }, { status: 500 });
  }
}
