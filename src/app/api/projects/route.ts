import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { requireTenant } from "@/lib/utils/tenant";
import { logAudit } from "@/lib/audit";

const createProjectSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  location: z.string().optional(),
});

export async function GET() {
  try {
    const user = await requireTenant();
    const projects = await prisma.project.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { inquiries: true, leistungsverzeichnis: true } } },
    });
    return NextResponse.json({ data: projects });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireTenant();
    const body = await req.json();
    const validated = createProjectSchema.parse(body);

    const project = await prisma.project.create({
      data: { ...validated, tenantId: user.tenantId },
    });

    await logAudit(user.tenantId, user.id, "PROJECT_CREATED", "Project", project.id, {
      name: project.name,
    });

    return NextResponse.json({ data: project }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 422 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
