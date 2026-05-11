import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireTenant();
    const { id } = await params;

    const project = await prisma.project.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        leistungsverzeichnis: {
          where: { extractionStatus: "COMPLETED" },
          include: {
            positions: {
              orderBy: [{ sortOrder: "asc" }, { positionNumber: "asc" }],
            },
          },
        },
        inquiries: {
          where: { status: "OFFER_RECEIVED" },
          include: {
            supplier: true,
            offers: {
              include: {
                offerItems: true,
              },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    if (!project) return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });

    const positions = project.leistungsverzeichnis.flatMap((lv) => lv.positions);

    const suppliers = project.inquiries
      .filter((inq) => inq.offers.length > 0)
      .map((inq) => ({
        id: inq.supplierId,
        companyName: inq.supplier.companyName,
        offerId: inq.offers[0].id,
        totalNet: inq.offers[0].totalNet?.toString() ?? null,
        items: Object.fromEntries(
          inq.offers[0].offerItems.map((item) => [
            item.positionId,
            { unitPrice: item.unitPrice?.toString() ?? null, totalPrice: item.totalPrice?.toString() ?? null },
          ])
        ),
      }));

    return NextResponse.json({ positions, suppliers, totalInquiries: project.inquiries.length });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
