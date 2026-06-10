import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

interface Params {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  trade: z.string().optional(),
  subject: z.string().min(1).optional(),
  bodyHtml: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireTenant();
    const { id } = await params;
    const body = await req.json();
    const validated = patchSchema.parse(body);

    const existing = await prisma.inquiryTemplate.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) return NextResponse.json({ error: "Vorlage nicht gefunden" }, { status: 404 });

    const updated = await prisma.inquiryTemplate.update({
      where: { id },
      data: validated,
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

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireTenant();
    const { id } = await params;

    const existing = await prisma.inquiryTemplate.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) return NextResponse.json({ error: "Vorlage nicht gefunden" }, { status: 404 });

    await prisma.inquiryTemplate.delete({ where: { id } });
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
