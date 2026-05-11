import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { requireTenant } from "@/lib/utils/tenant";

const createSupplierSchema = z.object({
  companyName: z.string().min(2).max(100),
  contactName: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  trade: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    const user = await requireTenant();
    const suppliers = await prisma.supplier.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      orderBy: { companyName: "asc" },
    });
    return NextResponse.json({ data: suppliers });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireTenant();
    const body = await req.json();
    const validated = createSupplierSchema.parse(body);

    const supplier = await prisma.supplier.create({
      data: { ...validated, tenantId: user.tenantId },
    });

    return NextResponse.json({ data: supplier }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 422 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
