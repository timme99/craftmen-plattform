import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { logAudit } from "@/lib/audit";

interface Params {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  positionId: z.string().uuid(),
  matchType: z.literal("manual"),
});

// PATCH /api/offer-items/[id]
// Allows manual confirmation/correction of a semantic match
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireTenant();
    const { id } = await params;
    const body = await req.json();
    const validated = patchSchema.parse(body);

    const existing = await prisma.offerItem.findFirst({
      where: { id },
      include: { offer: true },
    });
    if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    if (existing.offer.tenantId !== user.tenantId) {
      return NextResponse.json({ error: "Zugriff verweigert" }, { status: 403 });
    }

    const updated = await prisma.offerItem.update({
      where: { id },
      data: {
        positionId: validated.positionId,
        matchType: "manual",
        matchConfidence: 1.0,
      },
    });

    await logAudit(user.tenantId, user.id, "OFFER_ITEM_MATCH_CONFIRMED", "OfferItem", id, {
      previousPositionId: existing.positionId,
      newPositionId: validated.positionId,
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 422 });
    }
    console.error(err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
