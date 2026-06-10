import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  trade: z.string().optional(),
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
  isDefault: z.boolean().optional(),
});

export async function GET() {
  try {
    const user = await requireTenant();
    const templates = await prisma.inquiryTemplate.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
    return NextResponse.json({ data: templates });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireTenant();
    const body = await req.json();
    const validated = createSchema.parse(body);

    const template = await prisma.inquiryTemplate.create({
      data: { ...validated, tenantId: user.tenantId },
    });

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 422 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
