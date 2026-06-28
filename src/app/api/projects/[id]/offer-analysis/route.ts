import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma/client";
import { requireTenant } from "@/lib/utils/tenant";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { analyzeOffers, isAiEnabled } from "@/lib/anthropic/client";

interface Params {
  params: Promise<{ id: string }>;
}

const toNum = (val: { toString(): string } | null | undefined): number | null =>
  val != null ? Number(val.toString()) : null;

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireTenant();
    if (!isAiEnabled()) {
      return NextResponse.json({ error: "KI nicht konfiguriert" }, { status: 503 });
    }
    if (!checkRateLimit(`ai:${user.tenantId}`)) {
      return NextResponse.json({ error: "Zu viele Anfragen" }, { status: 429 });
    }

    const { id: projectId } = await params;

    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: user.tenantId },
      include: {
        leistungsverzeichnis: {
          where: { extractionStatus: "COMPLETED" },
          include: { positions: { orderBy: [{ sortOrder: "asc" }, { positionNumber: "asc" }] } },
        },
        inquiries: {
          where: { status: "OFFER_RECEIVED" },
          include: {
            supplier: true,
            offers: { include: { offerItems: true }, orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
    });

    if (!project) return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });

    const withOffers = project.inquiries.filter((inq) => inq.offers.length > 0);
    if (withOffers.length === 0) {
      return NextResponse.json({ error: "Noch keine Angebote zum Vergleichen vorhanden" }, { status: 400 });
    }

    const positions = project.leistungsverzeichnis.flatMap((lv) => lv.positions);

    const scores = await prisma.supplierScore.findMany({
      where: { tenantId: user.tenantId, supplierId: { in: withOffers.map((inq) => inq.supplierId) } },
    });
    const scoreBySupplier = new Map(scores.map((s) => [s.supplierId, s]));

    // Einzelpreis je Position je Lieferant (für Ausreißer-Erkennung).
    const priceLookup = new Map<string, Map<string, number | null>>(); // positionId -> supplierId -> unitPrice
    for (const inq of withOffers) {
      for (const item of inq.offers[0].offerItems) {
        if (!priceLookup.has(item.positionId)) priceLookup.set(item.positionId, new Map());
        priceLookup.get(item.positionId)!.set(inq.supplierId, toNum(item.unitPrice));
      }
    }

    const analysis = await analyzeOffers({
      projectName: project.name,
      positionCount: positions.length,
      suppliers: withOffers.map((inq) => {
        const score = scoreBySupplier.get(inq.supplierId);
        const offer = inq.offers[0];
        return {
          id: inq.supplierId,
          companyName: inq.supplier.companyName,
          totalNet: toNum(offer.totalNet),
          itemCount: offer.offerItems.length,
          deadlineMet:
            inq.deadline && offer.submittedAt ? offer.submittedAt <= inq.deadline : null,
          score: score
            ? {
                responseRate: Number(score.responseRate.toString()),
                deadlineRate: Number(score.deadlineRate.toString()),
                avgMatchQuality: Number(score.avgMatchQuality.toString()),
                priceStability: Number(score.priceStability.toString()),
              }
            : null,
        };
      }),
      positions: positions.map((p) => ({
        positionNumber: p.positionNumber,
        shortText: p.shortText,
        prices: withOffers.map((inq) => ({
          supplierId: inq.supplierId,
          unitPrice: priceLookup.get(p.id)?.get(inq.supplierId) ?? null,
        })),
      })),
    });

    await logAudit(user.tenantId, user.id, "AI_OFFER_ANALYSIS", "Project", projectId, {
      offerCount: withOffers.length,
    });

    return NextResponse.json({ data: analysis });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error("[offer-analysis] Anthropic error:", err.status, err.message);
      return NextResponse.json({ error: "KI-Dienst-Fehler" }, { status: err.status === 429 ? 429 : 502 });
    }
    console.error(err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
