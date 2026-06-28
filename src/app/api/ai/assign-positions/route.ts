import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma/client";
import { requireTenant } from "@/lib/utils/tenant";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { suggestPositionAssignments, isAiEnabled } from "@/lib/anthropic/client";

const schema = z.object({
  projectId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireTenant();
    if (!isAiEnabled()) {
      return NextResponse.json({ error: "KI nicht konfiguriert" }, { status: 503 });
    }
    if (!checkRateLimit(`ai:${user.tenantId}`)) {
      return NextResponse.json({ error: "Zu viele Anfragen" }, { status: 429 });
    }

    const input = schema.parse(await req.json());

    const [project, lv, suppliers] = await Promise.all([
      prisma.project.findFirst({ where: { id: input.projectId, tenantId: user.tenantId } }),
      prisma.leistungsverzeichnis.findFirst({
        where: { projectId: input.projectId, tenantId: user.tenantId, extractionStatus: "COMPLETED" },
        include: { positions: { orderBy: { sortOrder: "asc" } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.supplier.findMany({
        where: { tenantId: user.tenantId, isActive: true },
        orderBy: { companyName: "asc" },
      }),
    ]);

    if (!project) return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
    const positions = lv?.positions ?? [];
    if (positions.length === 0) {
      return NextResponse.json({ error: "Keine extrahierten Positionen vorhanden" }, { status: 400 });
    }
    if (suppliers.length === 0) {
      return NextResponse.json({ error: "Keine aktiven Lieferanten vorhanden" }, { status: 400 });
    }

    const result = await suggestPositionAssignments({
      positions: positions.map((p) => ({
        id: p.id,
        positionNumber: p.positionNumber,
        shortText: p.shortText,
        longText: p.longText,
        trade: p.trade,
      })),
      suppliers: suppliers.map((s) => ({ id: s.id, companyName: s.companyName, trade: s.trade })),
    });

    // Halluzinierte IDs aussortieren – nur gültige Positionen/Lieferanten zurückgeben.
    const positionIds = new Set(positions.map((p) => p.id));
    const supplierIds = new Set(suppliers.map((s) => s.id));
    const suggestions = result.suggestions
      .filter((s) => positionIds.has(s.positionId))
      .map((s) => ({
        ...s,
        suggestedSupplierIds: s.suggestedSupplierIds.filter((id) => supplierIds.has(id)),
      }))
      .filter((s) => s.suggestedSupplierIds.length > 0);

    await logAudit(user.tenantId, user.id, "AI_ASSIGN_SUGGESTED", "Project", input.projectId, {
      positionCount: positions.length,
      suggestionCount: suggestions.length,
    });

    return NextResponse.json({ data: { suggestions } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 422 });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("[ai/assign-positions] Anthropic error:", err.status, err.message);
      return NextResponse.json({ error: "KI-Dienst-Fehler" }, { status: err.status === 429 ? 429 : 502 });
    }
    console.error(err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
