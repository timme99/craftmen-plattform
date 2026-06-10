import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { safeEqualString } from "@/lib/security";
import { matchExtractedPositions } from "@/lib/matching/semantic";
import { logAudit } from "@/lib/audit";

const callbackSchema = z.object({
  inquiryId: z.string().uuid(),
  secret: z.string(),
  success: z.boolean(),
  positions: z
    .array(
      z.object({
        positionNumber: z.string(),
        shortText: z.string(),
        longText: z.string().optional(),
        unit: z.string().optional(),
        quantity: z.number().optional(),
        trade: z.string().optional(),
        sortOrder: z.number(),
        unitPrice: z.number().optional(),
        totalPrice: z.number().optional(),
      })
    )
    .optional(),
  error: z.string().optional(),
});

// Internal callback from Python microservice after processing an email PDF attachment
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (
    !body.secret ||
    !process.env.PDF_SERVICE_SECRET ||
    !safeEqualString(body.secret, process.env.PDF_SERVICE_SECRET)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const validated = callbackSchema.parse(body);

  const inquiry = await prisma.inquiry.findUnique({
    where: { id: validated.inquiryId },
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

  if (!inquiry) {
    return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
  }

  const offer = await prisma.offer.create({
    data: {
      inquiryId: inquiry.id,
      tenantId: inquiry.tenantId,
      source: "EMAIL_ATTACHMENT",
      submittedAt: new Date(),
    },
  });

  const lvPositions = inquiry.project.leistungsverzeichnis[0]?.positions ?? [];

  if (validated.success && validated.positions && lvPositions.length > 0) {
    const results = matchExtractedPositions(validated.positions, lvPositions);

    // Only create OfferItems for results with a candidate position
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
    const extractedCount = validated.positions.length;
    const matchRate = extractedCount > 0 ? Math.round((matchedCount / extractedCount) * 100) : 0;
    const confidenceLabel = matchRate >= 90 ? "SICHER" : matchRate >= 60 ? "PRUEFEN" : "UNKLAR";

    const reviewNeeded = results.filter(
      (r) => r.matchType === "unmatched" && r.positionId !== null
    );

    await prisma.offer.update({
      where: { id: offer.id },
      data: {
        notes: `Import-Qualität: ${confidenceLabel} (${matchedCount}/${extractedCount} Positionen gematcht, ${matchRate}%). Semantic: ${semanticCount}, Zur Prüfung: ${reviewNeeded.length}.`,
      },
    });

    const reviewPreview = reviewNeeded
      .slice(0, 5)
      .map((r) => r.extracted.positionNumber)
      .join(", ");

    await prisma.inquiry.update({
      where: { id: inquiry.id },
      data: {
        status: "OFFER_RECEIVED",
        notes:
          matchRate < 60
            ? `⚠️ Import-Ampel: UNKLAR (${matchedCount}/${extractedCount}, ${matchRate}%). Zur Prüfung: ${reviewNeeded.length}${reviewPreview ? ` | Beispiele: ${reviewPreview}` : ""}. Bitte manuell prüfen.`
            : `Import-Ampel: ${confidenceLabel} (${matchedCount}/${extractedCount}, ${matchRate}%). Zur Prüfung: ${reviewNeeded.length}${reviewPreview ? ` | Beispiele: ${reviewPreview}` : ""}.`,
      },
    });

    await logAudit(
      inquiry.tenantId,
      undefined,
      "OFFER_IMPORTED",
      "Offer",
      offer.id,
      {
        source: "EMAIL_ATTACHMENT",
        inquiryId: inquiry.id,
        extractedCount,
        matchedCount,
        matchRate,
        confidenceLabel,
      }
    );
  }

  return NextResponse.json({ ok: true });
}
