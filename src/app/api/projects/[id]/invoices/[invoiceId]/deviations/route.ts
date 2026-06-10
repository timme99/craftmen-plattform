import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";

interface Params {
  params: Promise<{ id: string; invoiceId: string }>;
}

// GET /api/projects/[id]/invoices/[invoiceId]/deviations
// Returns per-position comparison: invoice price vs. offer price
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireTenant();
    const { id: projectId, invoiceId } = await params;

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, projectId, tenantId: user.tenantId },
      include: {
        invoiceItems: { include: { position: true } },
        inquiry: {
          include: {
            offers: {
              include: {
                offerItems: { include: { position: true } },
              },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    if (!invoice) return NextResponse.json({ error: "Rechnung nicht gefunden" }, { status: 404 });

    const offerItems = invoice.inquiry.offers[0]?.offerItems ?? [];
    const offerItemsByPositionId = new Map(
      offerItems.filter((oi) => oi.positionId).map((oi) => [oi.positionId, oi])
    );

    const deviations = invoice.invoiceItems.map((invoiceItem) => {
      const offerItem = invoiceItem.positionId
        ? offerItemsByPositionId.get(invoiceItem.positionId)
        : undefined;

      const invoiceTotal = Number(invoiceItem.totalPrice);
      const offerTotal = offerItem ? Number(offerItem.totalPrice) : null;
      const deviation = offerTotal !== null ? invoiceTotal - offerTotal : null;
      const deviationPct =
        offerTotal !== null && offerTotal !== 0
          ? ((deviation! / offerTotal) * 100).toFixed(1)
          : null;

      return {
        positionId: invoiceItem.positionId,
        positionNumber: invoiceItem.position?.positionNumber ?? null,
        shortText: invoiceItem.position?.shortText ?? "Unbekannte Position",
        invoiceUnitPrice: Number(invoiceItem.unitPrice),
        invoiceTotalPrice: invoiceTotal,
        offerUnitPrice: offerItem ? Number(offerItem.unitPrice) : null,
        offerTotalPrice: offerTotal,
        deviation,
        deviationPct,
        hasDeviation: deviation !== null && Math.abs(deviation) > 0.01,
      };
    });

    const totalDeviation = deviations.reduce(
      (sum, d) => sum + (d.deviation ?? 0),
      0
    );

    return NextResponse.json({
      data: {
        deviations,
        summary: {
          totalInvoice: Number(invoice.totalNet),
          totalOffer: offerItems.reduce((s, oi) => s + Number(oi.totalPrice ?? 0), 0),
          totalDeviation,
          deviatingPositions: deviations.filter((d) => d.hasDeviation).length,
        },
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
