import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";

// GET /api/leistungsverzeichnisse?projectId=… — leichtgewichtiger Extraktionsstatus
// für das Client-Polling während PENDING/PROCESSING
export async function GET(req: NextRequest) {
  try {
    const user = await requireTenant();
    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId erforderlich" }, { status: 400 });
    }

    const lvs = await prisma.leistungsverzeichnis.findMany({
      where: { projectId, tenantId: user.tenantId },
      select: {
        id: true,
        extractionStatus: true,
        errorMessage: true,
        _count: { select: { positions: true } },
      },
    });

    return NextResponse.json({
      data: lvs.map((lv) => ({
        id: lv.id,
        extractionStatus: lv.extractionStatus,
        errorMessage: lv.errorMessage,
        positionCount: lv._count.positions,
      })),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
