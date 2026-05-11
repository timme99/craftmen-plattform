import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const schema = z.object({
  leistungsverzeichnisId: z.string().uuid(),
  positionNumber: z.string().min(1),
  shortText: z.string().min(1),
  unit: z.string().min(1),
  quantity: z.number().positive(),
  trade: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireTenant();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }
    const { leistungsverzeichnisId, ...data } = parsed.data;

    const lv = await prisma.leistungsverzeichnis.findFirst({
      where: { id: leistungsverzeichnisId, tenantId: user.tenantId },
    });
    if (!lv) return NextResponse.json({ error: "LV nicht gefunden" }, { status: 404 });

    const position = await prisma.position.create({
      data: { leistungsverzeichnisId, ...data },
    });

    return NextResponse.json(position, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Fehler beim Erstellen der Position" }, { status: 500 });
  }
}
