import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";

interface Params {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/audit
// Returns audit log entries for a project (direct + related inquiries/offers)
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireTenant();
    const { id: projectId } = await params;

    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: user.tenantId },
    });
    if (!project) return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });

    const inquiries = await prisma.inquiry.findMany({
      where: { projectId, tenantId: user.tenantId },
      select: { id: true },
    });
    const inquiryIds = inquiries.map((i) => i.id);

    const logs = await prisma.auditLog.findMany({
      where: {
        tenantId: user.tenantId,
        OR: [
          { entityType: "Project", entityId: projectId },
          { entityType: "Inquiry", entityId: { in: inquiryIds } },
          { entityType: "Offer" },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ data: logs });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
