import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";

const submitOfferSchema = z.object({
  inquiryId: z.string().uuid(),
  portalToken: z.string().uuid(),
  items: z.array(
    z.object({
      positionId: z.string().uuid(),
      unitPrice: z.number().nonnegative(),
      notes: z.string().optional(),
    })
  ),
  notes: z.string().optional(),
  validUntil: z.string().datetime().optional(),
  vatRate: z.number().min(0).max(100).optional(),
});

// Public route — suppliers submit via portal token (no auth required)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = submitOfferSchema.parse(body);

    const inquiry = await prisma.inquiry.findFirst({
      where: {
        id: validated.inquiryId,
        portalToken: validated.portalToken,
      },
      include: {
        project: {
          include: {
            leistungsverzeichnis: { include: { positions: true } },
          },
        },
      },
    });

    if (!inquiry) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }

    if (inquiry.status === "EXPIRED" || inquiry.status === "DECLINED") {
      return NextResponse.json({ error: "Inquiry is closed" }, { status: 410 });
    }

    const positions = inquiry.project.leistungsverzeichnis.flatMap(
      (lv) => lv.positions
    );

    const offerItems = validated.items
      .filter((item) => positions.some((p) => p.id === item.positionId))
      .map((item) => {
        const position = positions.find((p) => p.id === item.positionId)!;
        const totalPrice = position.quantity
          ? Number(position.quantity) * item.unitPrice
          : null;
        return {
          positionId: item.positionId,
          unitPrice: item.unitPrice,
          totalPrice,
          notes: item.notes,
        };
      });

    const totalNet = offerItems.reduce(
      (sum, item) => sum + (item.totalPrice ?? 0),
      0
    );
    const vatRate = validated.vatRate ?? 19;
    const totalGross = totalNet * (1 + vatRate / 100);

    const offer = await prisma.$transaction(async (tx) => {
      const newOffer = await tx.offer.create({
        data: {
          inquiryId: inquiry.id,
          tenantId: inquiry.tenantId,
          source: "PORTAL",
          totalNet,
          totalGross,
          vatRate,
          currency: "EUR",
          validUntil: validated.validUntil ? new Date(validated.validUntil) : null,
          notes: validated.notes,
          submittedAt: new Date(),
          offerItems: { create: offerItems },
        },
        include: { offerItems: true },
      });

      await tx.inquiry.update({
        where: { id: inquiry.id },
        data: { status: "OFFER_RECEIVED" },
      });

      return newOffer;
    });

    return NextResponse.json({ data: offer }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
