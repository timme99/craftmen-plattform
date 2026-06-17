import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { requireTenant } from "@/lib/utils/tenant";

interface Params {
  params: Promise<{ id: string }>;
}

const assignPositionsSchema = z.object({
  supplierId: z.string().uuid(),
  positionIds: z.array(z.string().uuid()).min(1),
});

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireTenant();
    const { id: projectId } = await params;
    const body = await req.json();
    const validated = assignPositionsSchema.parse(body);

    const [project, supplier, positions] = await Promise.all([
      prisma.project.findFirst({ where: { id: projectId, tenantId: user.tenantId } }),
      prisma.supplier.findFirst({ where: { id: validated.supplierId, tenantId: user.tenantId, isActive: true } }),
      prisma.position.findMany({
        where: {
          id: { in: validated.positionIds },
          leistungsverzeichnis: { projectId, tenantId: user.tenantId },
        },
        select: { id: true },
      }),
    ]);

    if (!project) return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
    if (!supplier) return NextResponse.json({ error: "Lieferant nicht gefunden" }, { status: 404 });
    if (positions.length !== validated.positionIds.length) {
      return NextResponse.json({ error: "Ungültige Positionen für dieses Projekt" }, { status: 400 });
    }

    const inquiry = await prisma.inquiry.upsert({
      where: { projectId_supplierId: { projectId, supplierId: validated.supplierId } },
      create: {
        projectId,
        supplierId: validated.supplierId,
        tenantId: user.tenantId,
        status: "DRAFT",
      },
      update: {},
    });

    await prisma.inquiryPosition.createMany({
      data: positions.map((position) => ({ inquiryId: inquiry.id, positionId: position.id })),
      skipDuplicates: true,
    });

    const assignments = await prisma.inquiryPosition.findMany({
      where: {
        positionId: { in: positions.map((position) => position.id) },
        inquiry: { projectId, tenantId: user.tenantId },
      },
      include: { inquiry: { include: { supplier: true } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      inquiryId: inquiry.id,
      assignments: assignments.map((assignment) => ({
        positionId: assignment.positionId,
        supplier: {
          id: assignment.inquiry.supplier.id,
          companyName: assignment.inquiry.supplier.companyName,
        },
      })),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 422 });
    }
    console.error(err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
