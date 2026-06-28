import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma/client";
import { requireTenant } from "@/lib/utils/tenant";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { extractPositionsFromPdf, toExtractedPositions, isAiEnabled } from "@/lib/anthropic/client";

interface Params {
  params: Promise<{ lvId: string }>;
}

// Nutzergesteuertes Claude-Backup, wenn die reguläre Extraktion fehlgeschlagen ist.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireTenant();
    if (!isAiEnabled()) {
      return NextResponse.json({ error: "KI nicht konfiguriert" }, { status: 503 });
    }
    if (!checkRateLimit(`ai:${user.tenantId}`)) {
      return NextResponse.json({ error: "Zu viele Anfragen" }, { status: 429 });
    }

    const { lvId } = await params;

    const lv = await prisma.leistungsverzeichnis.findFirst({
      where: { id: lvId, tenantId: user.tenantId },
    });
    if (!lv) return NextResponse.json({ error: "LV nicht gefunden" }, { status: 404 });

    // PDF aus Supabase Storage laden
    const supabase = await createClient();
    const { data: blob, error: dlError } = await supabase.storage
      .from("leistungsverzeichnisse")
      .download(lv.storagePath);
    if (dlError || !blob) {
      return NextResponse.json({ error: "PDF konnte nicht geladen werden" }, { status: 502 });
    }
    const pdfBuffer = Buffer.from(await blob.arrayBuffer());

    await prisma.leistungsverzeichnis.update({
      where: { id: lv.id },
      data: { extractionStatus: "PROCESSING", errorMessage: null },
    });

    let extracted;
    try {
      extracted = toExtractedPositions(await extractPositionsFromPdf(pdfBuffer));
    } catch (err) {
      await prisma.leistungsverzeichnis.update({
        where: { id: lv.id },
        data: {
          extractionStatus: "FAILED",
          errorMessage: `Claude-Backup fehlgeschlagen: ${(err as Error).message.slice(0, 400)}`,
        },
      });
      throw err;
    }

    if (extracted.length === 0) {
      await prisma.leistungsverzeichnis.update({
        where: { id: lv.id },
        data: { extractionStatus: "FAILED", errorMessage: "Claude-Backup: keine Positionen erkannt." },
      });
      return NextResponse.json({ error: "Keine Positionen erkannt" }, { status: 422 });
    }

    // Vorhandene Positionen ersetzen (idempotenter Re-Run) und Status setzen.
    await prisma.$transaction([
      prisma.position.deleteMany({ where: { leistungsverzeichnisId: lv.id } }),
      prisma.leistungsverzeichnis.update({
        where: { id: lv.id },
        data: { extractionStatus: "COMPLETED", extractedAt: new Date() },
      }),
      prisma.position.createMany({
        data: extracted.map((p) => ({
          leistungsverzeichnisId: lv.id,
          positionNumber: p.positionNumber,
          shortText: p.shortText,
          longText: p.longText,
          unit: p.unit,
          quantity: p.quantity,
          trade: p.trade,
          sortOrder: p.sortOrder,
        })),
      }),
    ]);

    await logAudit(user.tenantId, user.id, "LV_AI_EXTRACTED", "Leistungsverzeichnis", lv.id, {
      positionCount: extracted.length,
    });

    return NextResponse.json({ data: { count: extracted.length } });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error("[pdf-extract/ai-retry] Anthropic error:", err.status, err.message);
      return NextResponse.json({ error: "KI-Dienst-Fehler" }, { status: err.status === 429 ? 429 : 502 });
    }
    console.error(err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
