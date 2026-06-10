import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import type { CopilotItem } from "@/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

// GET /api/dashboard/briefing
// Returns prioritized copilot action items for the authenticated tenant
export async function GET() {
  try {
    const user = await requireTenant();
    const { tenantId } = user;
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [expiringInquiries, unklar, stalledProjects, openAnomalies] = await Promise.all([
      // Inquiries with deadline in ≤7 days
      prisma.inquiry.findMany({
        where: {
          tenantId,
          status: { in: ["SENT", "OPENED"] },
          deadline: { gte: now, lte: in7Days },
        },
        include: { supplier: true, project: true },
        orderBy: { deadline: "asc" },
        take: 10,
      }),

      // Offers with low match confidence (UNKLAR)
      prisma.offer.findMany({
        where: {
          tenantId,
          offerItems: { some: { matchConfidence: { lt: 0.6 } } },
        },
        include: { inquiry: { include: { supplier: true, project: true } } },
        take: 10,
      }),

      // Projects stuck in AWAITING_OFFERS with all deadlines past
      prisma.project.findMany({
        where: {
          tenantId,
          status: "AWAITING_OFFERS",
          inquiries: {
            every: {
              OR: [{ deadline: { lt: now } }, { deadline: null }],
            },
          },
        },
        take: 5,
      }),

      // High-severity unresolved price anomalies
      prisma.priceAnomaly.findMany({
        where: { tenantId, severity: "HIGH", resolvedAt: null },
        include: { project: true },
        take: 10,
      }),
    ]);

    const items: CopilotItem[] = [];

    for (const inquiry of expiringInquiries) {
      const daysLeft = Math.ceil(
        (inquiry.deadline!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      items.push({
        priority: daysLeft <= 1 ? "HIGH" : daysLeft <= 3 ? "MEDIUM" : "LOW",
        type: "EXPIRING_INQUIRY",
        title: `Anfrage läuft in ${daysLeft} Tag${daysLeft === 1 ? "" : "en"} ab`,
        description: `${inquiry.supplier.companyName} · Projekt: ${inquiry.project.name}`,
        actionUrl: `${APP_URL}/projects/${inquiry.projectId}/inquiries`,
        entityId: inquiry.id,
      });
    }

    for (const offer of unklar) {
      items.push({
        priority: "MEDIUM",
        type: "UNKLAR_MATCH",
        title: "Angebot erfordert manuelle Prüfung",
        description: `${offer.inquiry.supplier.companyName} · ${offer.inquiry.project.name} — Niedrige Matching-Qualität`,
        actionUrl: `${APP_URL}/projects/${offer.inquiry.projectId}/inquiries`,
        entityId: offer.id,
      });
    }

    for (const project of stalledProjects) {
      items.push({
        priority: "HIGH",
        type: "STALLED_PROJECT",
        title: "Projekt wartet auf Angebote (Frist abgelaufen)",
        description: project.name,
        actionUrl: `${APP_URL}/projects/${project.id}`,
        entityId: project.id,
      });
    }

    for (const anomaly of openAnomalies) {
      items.push({
        priority: "HIGH",
        type: "PRICE_ANOMALY",
        title: "Kritische Preisanomalie",
        description: `${anomaly.project.name} — ${anomaly.description}`,
        actionUrl: `${APP_URL}/projects/${anomaly.projectId}/preisspiegel`,
        entityId: anomaly.id,
      });
    }

    // Sort: HIGH first, then MEDIUM, then LOW
    const priority = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    items.sort((a, b) => priority[a.priority] - priority[b.priority]);

    return NextResponse.json({ data: items.slice(0, 20) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
