import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

const submitOfferSchema = z.object({
  inquiryId: z.string().uuid(),
  portalToken: z.string().uuid(),
  items: z
    .array(
      z.object({
        positionId: z.string().uuid(),
        unitPrice: z.number().nonnegative(),
        notes: z.string().optional(),
      })
    )
    .min(1),
  notes: z.string().optional(),
  validUntil: z.string().datetime().optional(),
  vatRate: z.number().min(0).max(100).optional(),
});

// Public route — suppliers submit via portal token (no auth required)
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!checkRateLimit(`offers:${ip}`)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

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
        positions: true,
      },
    });

    if (!inquiry) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }

    if (!checkRateLimit(`offers:${ip}:${inquiry.id}`)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    if (inquiry.status === "EXPIRED" || inquiry.status === "DECLINED") {
      return NextResponse.json({ error: "Inquiry is closed" }, { status: 410 });
    }

    const lvPositions = inquiry.project.leistungsverzeichnis.flatMap(
      (lv) => lv.positions
    );

    // Sind Positionen zugewiesen, darf nur für diese angeboten werden
    // (gleiche Logik wie im Portal); ohne Zuweisung gilt das komplette LV
    const assignedIds = new Set(inquiry.positions.map((p) => p.positionId));
    const positions =
      assignedIds.size > 0
        ? lvPositions.filter((p) => assignedIds.has(p.id))
        : lvPositions;

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
          matchConfidence: 1.0,
          matchType: "exact",
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

    await logAudit(inquiry.tenantId, undefined, "OFFER_SUBMITTED", "Offer", offer.id, {
      source: "PORTAL",
      inquiryId: inquiry.id,
      totalNet,
      totalGross,
    });

    return NextResponse.json({ data: offer }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 422 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
