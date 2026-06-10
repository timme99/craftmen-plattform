import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { logAudit } from "@/lib/audit";

interface Params {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "AWAITING_OFFERS", "COMPARING", "AWARDED", "COMPLETED", "ARCHIVED"]).optional(),
  name: z.string().min(1).optional(),
  location: z.string().optional(),
  description: z.string().optional(),
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

    const project = await prisma.project.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!project) return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });

    const updated = await prisma.project.update({
      where: { id },
      data: parsed.data,
    });

    if (parsed.data.status && parsed.data.status !== project.status) {
      await logAudit(user.tenantId, user.id, "PROJECT_STATUS_CHANGED", "Project", id, {
        from: project.status,
        to: parsed.data.status,
      });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
