import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { requireTenant } from "@/lib/utils/tenant";
import { logAudit } from "@/lib/audit";

// Angebot manuell einpflegen (bzw. aus PDF-Upload bestätigt) — authentifiziert, im Preisspiegel.
// Ein Offer hängt zwingend an einer Inquiry; darum wird bei Bedarf eine versandlose
// Anfrage (Ad-hoc) für den gewählten Lieferanten angelegt bzw. wiederverwendet.
const manualOfferSchema = z
  .object({
    projectId: z.string().uuid(),
    supplierId: z.string().uuid().optional(),
    newSupplier: z
      .object({
        companyName: z.string().min(1),
        email: z.string().email(),
      })
      .optional(),
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
  })
  .refine((v) => v.supplierId || v.newSupplier, {
    message: "supplierId oder newSupplier erforderlich",
    path: ["supplierId"],
  });

export async function POST(req: NextRequest) {
  try {
    const user = await requireTenant();
    const body = await req.json();
    const validated = manualOfferSchema.parse(body);

    const project = await prisma.project.findFirst({
      where: { id: validated.projectId, tenantId: user.tenantId },
      include: {
        leistungsverzeichnis: {
          where: { extractionStatus: "COMPLETED" },
          include: { positions: true },
        },
      },
    });
    if (!project) {
      return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
    }

    // Lieferant bestimmen: bestehenden validieren oder neuen (idempotent per E-Mail) anlegen.
    let supplierId = validated.supplierId ?? null;
    if (supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: supplierId, tenantId: user.tenantId },
        select: { id: true },
      });
      if (!supplier) {
        return NextResponse.json({ error: "Lieferant nicht gefunden" }, { status: 404 });
      }
    } else if (validated.newSupplier) {
      const supplier = await prisma.supplier.upsert({
        where: {
          tenantId_email: { tenantId: user.tenantId, email: validated.newSupplier.email },
        },
        create: {
          tenantId: user.tenantId,
          companyName: validated.newSupplier.companyName,
          email: validated.newSupplier.email,
        },
        update: {},
        select: { id: true },
      });
      supplierId = supplier.id;
    }
    if (!supplierId) {
      return NextResponse.json({ error: "Lieferant erforderlich" }, { status: 400 });
    }

    // Nur Positionen des Projekt-LV zulassen (Sicherheit / Mandantengrenze).
    const lvPositions = project.leistungsverzeichnis.flatMap((lv) => lv.positions);
    const positionById = new Map(lvPositions.map((p) => [p.id, p]));

    const offerItems = validated.items
      .filter((item) => positionById.has(item.positionId))
      .map((item) => {
        const position = positionById.get(item.positionId)!;
        const totalPrice = position.quantity
          ? Number(position.quantity) * item.unitPrice
          : item.unitPrice;
        return {
          positionId: item.positionId,
          unitPrice: item.unitPrice,
          totalPrice,
          notes: item.notes,
          matchConfidence: 1.0,
          matchType: "exact",
        };
      });

    if (offerItems.length === 0) {
      return NextResponse.json(
        { error: "Keine gültigen Positionen für dieses Projekt." },
        { status: 400 }
      );
    }

    const totalNet = offerItems.reduce((sum, item) => sum + (item.totalPrice ?? 0), 0);
    const vatRate = validated.vatRate ?? 19;
    const totalGross = totalNet * (1 + vatRate / 100);

    const offer = await prisma.$transaction(async (tx) => {
      // Versandlose Anfrage (Ad-hoc) anlegen oder bestehende wiederverwenden.
      const inquiry = await tx.inquiry.upsert({
        where: { projectId_supplierId: { projectId: project.id, supplierId } },
        create: {
          projectId: project.id,
          supplierId,
          tenantId: user.tenantId,
          status: "OFFER_RECEIVED",
        },
        update: { status: "OFFER_RECEIVED" },
      });

      return tx.offer.create({
        data: {
          inquiryId: inquiry.id,
          tenantId: user.tenantId,
          source: "MANUAL",
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
    });

    await logAudit(user.tenantId, user.id, "OFFER_SUBMITTED", "Offer", offer.id, {
      source: "MANUAL",
      projectId: project.id,
      supplierId,
      totalNet,
      totalGross,
      itemCount: offerItems.length,
    });

    return NextResponse.json({ data: offer }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 422 });
    }
    console.error(err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
