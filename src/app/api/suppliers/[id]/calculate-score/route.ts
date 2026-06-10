import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";

interface Params {
  params: Promise<{ id: string }>;
}

// POST /api/suppliers/[id]/calculate-score
// Computes and persists supplier performance score
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireTenant();
    const { id: supplierId } = await params;

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, tenantId: user.tenantId },
    });
    if (!supplier) return NextResponse.json({ error: "Lieferant nicht gefunden" }, { status: 404 });

    const inquiries = await prisma.inquiry.findMany({
      where: {
        supplierId,
        tenantId: user.tenantId,
        status: { not: "DRAFT" },
      },
      include: {
        offers: {
          include: {
            offerItems: { where: { matchConfidence: { not: null } } },
          },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    });

    const totalInquiries = inquiries.length;
    const offersReceived = inquiries.filter((i) => i.offers.length > 0);
    const totalOffers = offersReceived.length;

    // Response rate
    const responseRate = totalInquiries > 0 ? totalOffers / totalInquiries : 0;

    // Deadline adherence
    const withDeadline = inquiries.filter((i) => i.deadline && i.offers.length > 0);
    const onTime = withDeadline.filter((i) => {
      const submitted = i.offers[0]?.submittedAt;
      return submitted && i.deadline && submitted <= i.deadline;
    });
    const deadlineRate = withDeadline.length > 0 ? onTime.length / withDeadline.length : 0;

    // Average match quality
    const allItems = offersReceived.flatMap((i) => i.offers[0]?.offerItems ?? []);
    const matchedItems = allItems.filter((oi) => oi.matchConfidence !== null);
    const avgMatchQuality =
      matchedItems.length > 0
        ? matchedItems.reduce((sum, oi) => sum + (oi.matchConfidence ?? 0), 0) / matchedItems.length
        : 0;

    // Price stability (1 - coefficient of variation)
    const prices = allItems
      .filter((oi) => oi.unitPrice !== null)
      .map((oi) => Number(oi.unitPrice));
    let priceStability = 1;
    if (prices.length >= 2) {
      const mean = prices.reduce((s, p) => s + p, 0) / prices.length;
      if (mean > 0) {
        const variance = prices.reduce((s, p) => s + Math.pow(p - mean, 2), 0) / prices.length;
        const stddev = Math.sqrt(variance);
        const cv = stddev / mean;
        priceStability = Math.max(0, Math.min(1, 1 - cv));
      }
    }

    const score = await prisma.supplierScore.upsert({
      where: { supplierId },
      create: {
        supplierId,
        tenantId: user.tenantId,
        responseRate,
        deadlineRate,
        avgMatchQuality,
        priceStability,
        totalInquiries,
        totalOffers,
        lastCalculatedAt: new Date(),
      },
      update: {
        responseRate,
        deadlineRate,
        avgMatchQuality,
        priceStability,
        totalInquiries,
        totalOffers,
        lastCalculatedAt: new Date(),
      },
    });

    return NextResponse.json({ data: score });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
