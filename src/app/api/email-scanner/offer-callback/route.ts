import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { safeEqualString } from "@/lib/security";

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
      })
    )
    .optional(),
  error: z.string().optional(),
});

// Internal callback from Python microservice after processing an email PDF attachment
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.secret || !process.env.PDF_SERVICE_SECRET || !safeEqualString(body.secret, process.env.PDF_SERVICE_SECRET)) {
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

  // Match extracted positions against LV positions by positionNumber and create OfferItems
  const lvPositions = inquiry.project.leistungsverzeichnis[0]?.positions ?? [];
  if (validated.success && validated.positions && lvPositions.length > 0) {
    const positionMap = new Map(lvPositions.map((p) => [p.positionNumber, p.id]));
    const offerItems = validated.positions
      .filter((p) => positionMap.has(p.positionNumber))
      .map((p) => ({
        offerId: offer.id,
        positionId: positionMap.get(p.positionNumber)!,
      }));

    if (offerItems.length > 0) {
      await prisma.offerItem.createMany({ data: offerItems, skipDuplicates: true });
    }

    const matchedCount = offerItems.length;
    const extractedCount = validated.positions.length;
    const matchRate = extractedCount > 0 ? Math.round((matchedCount / extractedCount) * 100) : 0;
    const confidenceLabel = matchRate >= 90 ? "HOCH" : matchRate >= 60 ? "MITTEL" : "NIEDRIG";

    await prisma.offer.update({
      where: { id: offer.id },
      data: {
        notes: `Import-Qualität: ${confidenceLabel} (${matchedCount}/${extractedCount} Positionen gematcht, ${matchRate}%)`,
      },
    });

    await prisma.inquiry.update({
      where: { id: inquiry.id },
      data: {
        status: "OFFER_RECEIVED",
        notes:
          matchRate < 60
            ? `⚠️ Geringe Import-Qualität beim E-Mail-Angebot (${matchedCount}/${extractedCount}, ${matchRate}%). Bitte prüfen.`
            : `Import-Qualität: ${confidenceLabel} (${matchedCount}/${extractedCount}, ${matchRate}%).`,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
