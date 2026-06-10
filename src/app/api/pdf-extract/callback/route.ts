import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { safeEqualString } from "@/lib/security";

const callbackSchema = z.object({
  lvId: z.string().uuid(),
  secret: z.string(),
  success: z.boolean(),
  positions: z
    .array(
      z.object({
        positionNumber: z.string(),
        shortText: z.string(),
        // Python service serializes empty fields as null, not undefined
        longText: z.string().nullish(),
        unit: z.string().nullish(),
        quantity: z.number().nullish(),
        trade: z.string().nullish(),
        sortOrder: z.number(),
      })
    )
    .optional(),
  error: z.string().optional(),
});

// Internal callback from Python microservice
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.secret || !process.env.PDF_SERVICE_SECRET || !safeEqualString(body.secret, process.env.PDF_SERVICE_SECRET)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = callbackSchema.safeParse(body);
  if (!parsed.success) {
    // Mark the LV as failed so it doesn't stay in PROCESSING forever
    if (typeof body.lvId === "string") {
      await prisma.leistungsverzeichnis
        .update({
          where: { id: body.lvId },
          data: {
            extractionStatus: "FAILED",
            errorMessage: `Ungültiges Callback-Format: ${parsed.error.message.slice(0, 500)}`,
          },
        })
        .catch(() => {});
    }
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const validated = parsed.data;

  if (!validated.success || !validated.positions) {
    await prisma.leistungsverzeichnis.update({
      where: { id: validated.lvId },
      data: {
        extractionStatus: "FAILED",
        errorMessage: validated.error ?? "Unknown error",
      },
    });
    return NextResponse.json({ ok: true });
  }

  await prisma.$transaction([
    prisma.leistungsverzeichnis.update({
      where: { id: validated.lvId },
      data: { extractionStatus: "COMPLETED", extractedAt: new Date() },
    }),
    prisma.position.createMany({
      data: validated.positions.map((p) => ({
        leistungsverzeichnisId: validated.lvId,
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

  return NextResponse.json({ ok: true });
}
