import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@prisma/client";

interface Params {
  params: Promise<{ id: string }>;
}

// POST /api/projects/[id]/preisspiegel/analyze
// Computes price anomalies and persists them to price_anomalies table
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireTenant();
    const { id: projectId } = await params;

    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: user.tenantId },
      include: {
        leistungsverzeichnis: {
          where: { extractionStatus: "COMPLETED" },
          include: {
            positions: {
              include: {
                offerItems: {
                  include: { offer: { include: { inquiry: { include: { supplier: true } } } } },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!project) return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });

    const lv = project.leistungsverzeichnis[0];
    if (!lv) return NextResponse.json({ error: "Kein abgeschlossenes LV gefunden" }, { status: 400 });

    const inquiries = await prisma.inquiry.findMany({
      where: { projectId, tenantId: user.tenantId },
    });
    const totalSuppliers = inquiries.length;

    // Delete previous anomalies for this project
    await prisma.priceAnomaly.deleteMany({ where: { projectId, tenantId: user.tenantId } });

    const anomalies: Prisma.PriceAnomalyCreateManyInput[] = [];

    for (const position of lv.positions) {
      const prices = position.offerItems
        .filter((oi) => oi.unitPrice !== null)
        .map((oi) => Number(oi.unitPrice));

      if (prices.length === 0) {
        // MISSING_POSITION: no supplier submitted a price
        anomalies.push({
          projectId,
          tenantId: user.tenantId,
          positionId: position.id,
          anomalyType: "MISSING_POSITION",
          severity: "HIGH",
          description: `Position ${position.positionNumber} „${position.shortText}" hat keine Angebote.`,
        });
        continue;
      }

      // COVERAGE_GAP: fewer than 50% of suppliers submitted
      if (totalSuppliers > 1 && prices.length / totalSuppliers < 0.5) {
        anomalies.push({
          projectId,
          tenantId: user.tenantId,
          positionId: position.id,
          anomalyType: "COVERAGE_GAP",
          severity: "MEDIUM",
          description: `Position ${position.positionNumber}: nur ${prices.length} von ${totalSuppliers} Lieferanten haben einen Preis geliefert.`,
          value: prices.length,
          referenceValue: totalSuppliers,
        });
      }

      if (prices.length < 2) continue;

      const sorted = [...prices].sort((a, b) => a - b);
      const median = sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];

      // PRICE_OUTLIER: any price >35% above median
      for (const price of prices) {
        if (price > median * 1.35) {
          const ratio = price / median;
          const severity = ratio > 2 ? "HIGH" : ratio > 1.5 ? "MEDIUM" : "LOW";
          anomalies.push({
            projectId,
            tenantId: user.tenantId,
            positionId: position.id,
            anomalyType: "PRICE_OUTLIER",
            severity,
            description: `Position ${position.positionNumber}: Preis ${price.toFixed(2)} € ist ${((ratio - 1) * 100).toFixed(0)}% über dem Median (${median.toFixed(2)} €).`,
            value: price,
            referenceValue: median,
          });
          break; // one anomaly per position
        }
      }
    }

    if (anomalies.length > 0) {
      await prisma.priceAnomaly.createMany({ data: anomalies });
    }

    return NextResponse.json({
      data: {
        total: anomalies.length,
        byType: {
          MISSING_POSITION: anomalies.filter((a) => a.anomalyType === "MISSING_POSITION").length,
          COVERAGE_GAP: anomalies.filter((a) => a.anomalyType === "COVERAGE_GAP").length,
          PRICE_OUTLIER: anomalies.filter((a) => a.anomalyType === "PRICE_OUTLIER").length,
        },
        bySeverity: {
          HIGH: anomalies.filter((a) => a.severity === "HIGH").length,
          MEDIUM: anomalies.filter((a) => a.severity === "MEDIUM").length,
          LOW: anomalies.filter((a) => a.severity === "LOW").length,
        },
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
