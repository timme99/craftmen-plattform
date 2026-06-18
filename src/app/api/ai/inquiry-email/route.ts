import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma/client";
import { requireTenant } from "@/lib/utils/tenant";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { draftInquiryEmail, isAiEnabled } from "@/lib/anthropic/client";

const schema = z.object({
  projectId: z.string().uuid(),
  supplierId: z.string().uuid(),
  tone: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
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

    const [project, supplier] = await Promise.all([
      prisma.project.findFirst({ where: { id: input.projectId, tenantId: user.tenantId } }),
      prisma.supplier.findFirst({ where: { id: input.supplierId, tenantId: user.tenantId } }),
    ]);
    if (!project) return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
    if (!supplier) return NextResponse.json({ error: "Lieferant nicht gefunden" }, { status: 404 });

    // Bevorzugt die dem Lieferanten zugewiesenen Positionen; sonst das aktuelle LV.
    const inquiry = await prisma.inquiry.findUnique({
      where: { projectId_supplierId: { projectId: input.projectId, supplierId: input.supplierId } },
      include: {
        positions: { include: { position: true }, orderBy: { position: { sortOrder: "asc" } } },
      },
    });

    let positions = inquiry?.positions.map((a) => a.position) ?? [];
    if (positions.length === 0) {
      const lv = await prisma.leistungsverzeichnis.findFirst({
        where: { projectId: input.projectId, tenantId: user.tenantId, extractionStatus: "COMPLETED" },
        include: { positions: { orderBy: { sortOrder: "asc" } } },
        orderBy: { createdAt: "desc" },
      });
      positions = lv?.positions ?? [];
    }

    const draft = await draftInquiryEmail({
      projectName: project.name,
      projectDescription: project.description,
      projectLocation: project.location,
      supplierCompany: supplier.companyName,
      supplierContact: supplier.contactName,
      supplierTrade: supplier.trade,
      deadline: inquiry?.deadline ?? null,
      tone: input.tone,
      notes: input.notes,
      positions: positions.map((p) => ({
        positionNumber: p.positionNumber,
        shortText: p.shortText,
        quantity: p.quantity?.toString() ?? null,
        unit: p.unit,
      })),
    });

    await logAudit(user.tenantId, user.id, "AI_EMAIL_DRAFTED", "Supplier", supplier.id, {
      projectId: input.projectId,
    });

    return NextResponse.json({ data: draft });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 422 });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("[ai/inquiry-email] Anthropic error:", err.status, err.message);
      return NextResponse.json({ error: "KI-Dienst-Fehler" }, { status: err.status === 429 ? 429 : 502 });
    }
    console.error(err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
