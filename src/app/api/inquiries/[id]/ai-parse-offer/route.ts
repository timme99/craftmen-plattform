import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma/client";
import { requireTenant } from "@/lib/utils/tenant";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { getMessageAttachments } from "@/lib/graph/client";
import { matchExtractedPositions } from "@/lib/matching/semantic";
import { extractPositionsFromPdf, isAiEnabled } from "@/lib/anthropic/client";

interface Params {
  params: Promise<{ id: string }>;
}

interface GraphAttachment {
  contentType?: string;
  name?: string;
  contentBytes?: string;
}

// Nutzergesteuertes Claude-Backup, um ein Lieferantenangebot aus dem E-Mail-PDF auszulesen.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireTenant();
    if (!isAiEnabled()) {
      return NextResponse.json({ error: "KI nicht konfiguriert" }, { status: 503 });
    }
    if (!checkRateLimit(`ai:${user.tenantId}`)) {
      return NextResponse.json({ error: "Zu viele Anfragen" }, { status: 429 });
    }

    const { id: inquiryId } = await params;

    const inquiry = await prisma.inquiry.findFirst({
      where: { id: inquiryId, tenantId: user.tenantId },
      include: {
        project: {
          include: {
            leistungsverzeichnis: {
              where: { extractionStatus: "COMPLETED" },
              include: { positions: true },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });
    if (!inquiry) return NextResponse.json({ error: "Anfrage nicht gefunden" }, { status: 404 });
    if (!inquiry.emailMessageId) {
      return NextResponse.json({ error: "Keine zugeordnete E-Mail vorhanden" }, { status: 400 });
    }

    const emailConn = await prisma.emailConnection.findUnique({ where: { tenantId: user.tenantId } });
    if (!emailConn?.accessToken || !emailConn.emailAddress) {
      return NextResponse.json({ error: "Keine E-Mail-Verbindung konfiguriert" }, { status: 400 });
    }

    const attachmentsResponse = (await getMessageAttachments(
      emailConn.accessToken,
      emailConn.emailAddress,
      inquiry.emailMessageId
    )) as { value?: GraphAttachment[] };

    const pdf = (attachmentsResponse.value ?? []).find(
      (a) => a.contentBytes && (a.contentType?.includes("pdf") || a.name?.toLowerCase().endsWith(".pdf"))
    );
    if (!pdf?.contentBytes) {
      return NextResponse.json({ error: "Kein PDF-Anhang in der E-Mail gefunden" }, { status: 400 });
    }

    const pdfBuffer = Buffer.from(pdf.contentBytes, "base64");
    const extracted = await extractPositionsFromPdf(pdfBuffer, { withPrices: true });

    const offer = await prisma.offer.create({
      data: {
        inquiryId: inquiry.id,
        tenantId: inquiry.tenantId,
        source: "EMAIL_ATTACHMENT",
        submittedAt: new Date(),
      },
    });

    const lvPositions = inquiry.project.leistungsverzeichnis[0]?.positions ?? [];

    if (extracted.length > 0 && lvPositions.length > 0) {
      const results = matchExtractedPositions(extracted, lvPositions);

      const itemsToCreate = results
        .filter((r) => r.positionId !== null)
        .map((r) => ({
          offerId: offer.id,
          positionId: r.positionId!,
          unitPrice: r.extracted.unitPrice ?? null,
          totalPrice: r.extracted.totalPrice ?? null,
          matchConfidence: r.confidence,
          matchType: r.matchType,
        }));

      if (itemsToCreate.length > 0) {
        await prisma.offerItem.createMany({ data: itemsToCreate, skipDuplicates: true });
      }

      const exactCount = results.filter((r) => r.matchType === "exact").length;
      const semanticCount = results.filter(
        (r) => r.matchType !== "exact" && r.positionId !== null && r.confidence >= 0.9
      ).length;
      const matchedCount = exactCount + semanticCount;
      const extractedCount = extracted.length;
      const matchRate = extractedCount > 0 ? Math.round((matchedCount / extractedCount) * 100) : 0;
      const confidenceLabel = matchRate >= 90 ? "SICHER" : matchRate >= 60 ? "PRUEFEN" : "UNKLAR";

      await prisma.offer.update({
        where: { id: offer.id },
        data: {
          notes: `Claude-Backup-Import: ${confidenceLabel} (${matchedCount}/${extractedCount} Positionen gematcht, ${matchRate}%).`,
        },
      });

      await prisma.inquiry.update({
        where: { id: inquiry.id },
        data: {
          status: "OFFER_RECEIVED",
          notes: `Claude-Backup-Import: ${confidenceLabel} (${matchedCount}/${extractedCount}, ${matchRate}%).`,
        },
      });

      await logAudit(user.tenantId, user.id, "OFFER_IMPORTED", "Offer", offer.id, {
        source: "EMAIL_ATTACHMENT_AI",
        inquiryId: inquiry.id,
        extractedCount,
        matchedCount,
        matchRate,
        confidenceLabel,
      });

      return NextResponse.json({ data: { offerId: offer.id, extractedCount, matchedCount, matchRate } });
    }

    await prisma.inquiry.update({
      where: { id: inquiry.id },
      data: { status: "OFFER_RECEIVED" },
    });
    await logAudit(user.tenantId, user.id, "OFFER_IMPORTED", "Offer", offer.id, {
      source: "EMAIL_ATTACHMENT_AI",
      inquiryId: inquiry.id,
      extractedCount: extracted.length,
      matchedCount: 0,
    });

    return NextResponse.json({ data: { offerId: offer.id, extractedCount: extracted.length, matchedCount: 0 } });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error("[inquiries/ai-parse-offer] Anthropic error:", err.status, err.message);
      return NextResponse.json({ error: "KI-Dienst-Fehler" }, { status: err.status === 429 ? 429 : 502 });
    }
    console.error(err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
