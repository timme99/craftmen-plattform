import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireTenant();
    const { id } = await params;

    const inquiry = await prisma.inquiry.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        supplier: true,
        offers: {
          include: {
            offerItems: {
              include: { position: true },
              orderBy: { position: { positionNumber: "asc" } },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!inquiry) return NextResponse.json({ error: "Anfrage nicht gefunden" }, { status: 404 });

    return NextResponse.json(inquiry);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}

const patchSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "OPENED", "OFFER_RECEIVED", "DECLINED", "EXPIRED"]).optional(),
  notes: z.string().optional(),
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

    const inquiry = await prisma.inquiry.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!inquiry) return NextResponse.json({ error: "Anfrage nicht gefunden" }, { status: 404 });

    const updated = await prisma.inquiry.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
