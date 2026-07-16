import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import { logAudit } from "@/lib/audit";
import { normalizeUnit } from "@/lib/utils/units";
import { z } from "zod";

interface Params {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  positionNumber: z.string().min(1).optional(),
  shortText: z.string().min(1).optional(),
  longText: z.string().nullish(),
  unit: z.string().nullish(),
  quantity: z.number().positive().nullish(),
  trade: z.string().nullish(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireTenant();
    const { id } = await params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const existing = await prisma.position.findFirst({
      where: { id, leistungsverzeichnis: { tenantId: user.tenantId } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Position nicht gefunden" }, { status: 404 });
    }

    const data = { ...parsed.data };
    // Nur normalisieren, wenn das Feld im Payload steht (fehlend ≠ auf null setzen)
    if ("unit" in data && data.unit !== undefined) {
      data.unit = normalizeUnit(data.unit);
    }

    const updated = await prisma.position.update({
      where: { id },
      data,
    });

    await logAudit(user.tenantId, user.id, "POSITION_UPDATED", "Position", id, {
      positionNumber: updated.positionNumber,
      changes: data,
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Fehler beim Aktualisieren der Position" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireTenant();
    const { id } = await params;

    const existing = await prisma.position.findFirst({
      where: { id, leistungsverzeichnis: { tenantId: user.tenantId } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Position nicht gefunden" }, { status: 404 });
    }

    // Deleting a position cascades to its offer items — block if offers exist
    const linkedOfferItems = await prisma.offerItem.count({ where: { positionId: id } });
    if (linkedOfferItems > 0) {
      return NextResponse.json(
        {
          error:
            "Diese Position kann nicht gelöscht werden, weil bereits Angebotspreise dafür vorliegen.",
        },
        { status: 409 }
      );
    }

    await prisma.position.delete({ where: { id } });

    await logAudit(user.tenantId, user.id, "POSITION_DELETED", "Position", id, {
      positionNumber: existing.positionNumber,
      shortText: existing.shortText,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Fehler beim Löschen der Position" }, { status: 500 });
  }
}
