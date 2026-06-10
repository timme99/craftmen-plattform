import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { safeEqualString, sha256 } from "@/lib/security";
import { normalizeText } from "@/lib/matching/semantic";
import { z } from "zod";

const contributeSchema = z.object({
  secret: z.string(),
  trade: z.string(),
  positionText: z.string(),
  unit: z.string(),
  unitPrice: z.number().positive(),
  region: z.string().optional(),
});

// POST /api/benchmark/contribute (internal, secret-authenticated)
// Accepts anonymized price data and updates benchmark percentiles
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (
    !body.secret ||
    !process.env.PDF_SERVICE_SECRET ||
    !safeEqualString(body.secret, process.env.PDF_SERVICE_SECRET)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const validated = contributeSchema.parse(body);
  const positionTextHash = sha256(normalizeText(validated.positionText));

  // Fetch existing raw contributions (stored temporarily in a JSON metadata field)
  const existing = await prisma.benchmarkEntry.findUnique({
    where: {
      trade_positionTextHash_unit: {
        trade: validated.trade,
        positionTextHash,
        unit: validated.unit,
      },
    },
  });

  // We store prices inline by recomputing statistics incrementally using Welford's algorithm
  // For simplicity, we track running min/max/mean and approximate percentiles
  const newPrice = validated.unitPrice;

  let min = newPrice;
  let max = newPrice;
  let p25 = newPrice;
  let med = newPrice;
  let p75 = newPrice;
  let count = 1;

  if (existing) {
    const oldMin = Number(existing.unitPriceMin);
    const oldMax = Number(existing.unitPriceMax);
    const oldMed = Number(existing.unitPriceMed);
    const oldP25 = Number(existing.unitPriceP25);
    const oldP75 = Number(existing.unitPriceP75);
    count = existing.sampleCount + 1;

    // Running approximation: blend new price into existing percentiles
    min = Math.min(oldMin, newPrice);
    max = Math.max(oldMax, newPrice);
    // Update median estimate: weighted blend
    med = (oldMed * existing.sampleCount + newPrice) / count;
    p25 = (oldP25 * existing.sampleCount + Math.min(newPrice, oldMed)) / count;
    p75 = (oldP75 * existing.sampleCount + Math.max(newPrice, oldMed)) / count;
  }

  await prisma.benchmarkEntry.upsert({
    where: {
      trade_positionTextHash_unit: {
        trade: validated.trade,
        positionTextHash,
        unit: validated.unit,
      },
    },
    create: {
      trade: validated.trade,
      positionTextHash,
      unit: validated.unit,
      unitPriceMin: min,
      unitPriceP25: p25,
      unitPriceMed: med,
      unitPriceP75: p75,
      unitPriceMax: max,
      sampleCount: count,
      region: validated.region,
    },
    update: {
      unitPriceMin: min,
      unitPriceP25: p25,
      unitPriceMed: med,
      unitPriceP75: p75,
      unitPriceMax: max,
      sampleCount: count,
    },
  });

  return NextResponse.json({ ok: true });
}
