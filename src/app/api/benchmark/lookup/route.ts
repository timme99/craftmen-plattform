import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import { sha256 } from "@/lib/security";
import { normalizeText } from "@/lib/matching/semantic";

const MIN_SAMPLES = 5;

// GET /api/benchmark/lookup?trade=X&unit=Y&text=Z
// Returns anonymized price band for a position type (min 5 samples required)
export async function GET(req: NextRequest) {
  try {
    await requireTenant();

    const { searchParams } = new URL(req.url);
    const trade = searchParams.get("trade") ?? "";
    const unit = searchParams.get("unit") ?? "";
    const text = searchParams.get("text") ?? "";

    if (!trade || !unit || !text) {
      return NextResponse.json({ error: "trade, unit, text sind erforderlich" }, { status: 400 });
    }

    const positionTextHash = sha256(normalizeText(text));

    const entry = await prisma.benchmarkEntry.findUnique({
      where: { trade_positionTextHash_unit: { trade, positionTextHash, unit } },
    });

    if (!entry || entry.sampleCount < MIN_SAMPLES) {
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({
      data: {
        unitPriceMin: Number(entry.unitPriceMin),
        unitPriceP25: Number(entry.unitPriceP25),
        unitPriceMed: Number(entry.unitPriceMed),
        unitPriceP75: Number(entry.unitPriceP75),
        unitPriceMax: Number(entry.unitPriceMax),
        sampleCount: entry.sampleCount,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
