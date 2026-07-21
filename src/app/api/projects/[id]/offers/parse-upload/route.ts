import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma/client";
import { requireTenant } from "@/lib/utils/tenant";
import { checkRateLimit } from "@/lib/rate-limit";
import { matchExtractedPositions } from "@/lib/matching/semantic";
import { extractPositionsFromPdf, isAiEnabled } from "@/lib/anthropic/client";

interface Params {
  params: Promise<{ id: string }>;
}

// Liest ein hochgeladenes Angebots-PDF per Claude aus und matcht es gegen das Projekt-LV.
// Speichert NICHTS — liefert nur eine Vorschau zur Prüfung/Korrektur, die dann über
// POST /api/projects/[id]/offers bestätigt wird.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireTenant();
    const { id: projectId } = await params;

    if (!isAiEnabled()) {
      return NextResponse.json({ error: "KI nicht konfiguriert" }, { status: 503 });
    }
    if (!checkRateLimit(`ai:${user.tenantId}`)) {
      return NextResponse.json({ error: "Zu viele Anfragen" }, { status: 429 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "file erforderlich" }, { status: 400 });
    }
    if (file.type && !file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Nur PDF-Dateien werden unterstützt." }, { status: 400 });
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: user.tenantId },
      include: {
        leistungsverzeichnis: {
          where: { extractionStatus: "COMPLETED" },
          include: { positions: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    if (!project) {
      return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
    }

    const lvPositions = project.leistungsverzeichnis[0]?.positions ?? [];
    if (lvPositions.length === 0) {
      return NextResponse.json(
        { error: "Keine extrahierten LV-Positionen vorhanden. Bitte zuerst ein Leistungsverzeichnis hochladen." },
        { status: 400 }
      );
    }

    const pdfBuffer = Buffer.from(await file.arrayBuffer());
    const extracted = await extractPositionsFromPdf(pdfBuffer, { withPrices: true });

    const results = matchExtractedPositions(extracted, lvPositions);
    const quantityById = new Map(lvPositions.map((p) => [p.id, p.quantity ? Number(p.quantity) : null]));

    // Pro getroffener LV-Position einen Vorschlags-Einzelpreis ableiten
    // (Einzelpreis bevorzugt, sonst aus Gesamtpreis / Menge).
    const items = results
      .filter((r) => r.positionId !== null)
      .map((r) => {
        const qty = quantityById.get(r.positionId!) ?? null;
        let unitPrice = r.extracted.unitPrice ?? null;
        if (unitPrice == null && r.extracted.totalPrice != null && qty && qty > 0) {
          unitPrice = r.extracted.totalPrice / qty;
        }
        return {
          positionId: r.positionId!,
          unitPrice: unitPrice != null ? Math.round(unitPrice * 100) / 100 : null,
          matchType: r.matchType,
          confidence: Math.round(r.confidence * 100) / 100,
          extractedNumber: r.extracted.positionNumber,
        };
      });

    const unmatched = results
      .filter((r) => r.positionId === null)
      .map((r) => ({
        positionNumber: r.extracted.positionNumber,
        shortText: r.extracted.shortText,
        unitPrice: r.extracted.unitPrice ?? null,
      }));

    const matchedCount = items.length;
    const extractedCount = extracted.length;
    const matchRate = extractedCount > 0 ? Math.round((matchedCount / extractedCount) * 100) : 0;
    const confidenceLabel = matchRate >= 90 ? "SICHER" : matchRate >= 60 ? "PRÜFEN" : "UNKLAR";

    return NextResponse.json({
      data: {
        fileName: file.name,
        extractedCount,
        matchedCount,
        matchRate,
        confidenceLabel,
        items,
        unmatched,
      },
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error("[projects/offers/parse-upload] Anthropic error:", err.status, err.message);
      return NextResponse.json({ error: "KI-Dienst-Fehler" }, { status: err.status === 429 ? 429 : 502 });
    }
    console.error(err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
