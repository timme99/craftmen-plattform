import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";

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

  if (body.secret !== process.env.PDF_SERVICE_SECRET) {
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
  }

  return NextResponse.json({ ok: true });
}
