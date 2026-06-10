import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

interface Params {
  params: Promise<{ id: string }>;
}

const createInvoiceSchema = z.object({
  inquiryId: z.string().uuid(),
  invoiceNumber: z.string().min(1),
  issuedAt: z.string().datetime(),
  vatRate: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      positionId: z.string().uuid().optional(),
      unitPrice: z.number().nonnegative(),
      totalPrice: z.number().nonnegative(),
      notes: z.string().optional(),
    })
  ),
});

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireTenant();
    const { id: projectId } = await params;

    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: user.tenantId },
    });
    if (!project) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const invoices = await prisma.invoice.findMany({
      where: { projectId, tenantId: user.tenantId },
      include: {
        invoiceItems: { include: { position: true } },
        inquiry: { include: { supplier: true } },
      },
      orderBy: { issuedAt: "desc" },
    });

    return NextResponse.json({ data: invoices });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireTenant();
    const { id: projectId } = await params;
    const body = await req.json();
    const validated = createInvoiceSchema.parse(body);

    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: user.tenantId },
    });
    if (!project) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const inquiry = await prisma.inquiry.findFirst({
      where: { id: validated.inquiryId, projectId, tenantId: user.tenantId },
    });
    if (!inquiry) return NextResponse.json({ error: "Anfrage nicht gefunden" }, { status: 404 });

    const totalNet = validated.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const vatRate = validated.vatRate ?? 19;
    const totalGross = totalNet * (1 + vatRate / 100);

    const invoice = await prisma.invoice.create({
      data: {
        projectId,
        inquiryId: validated.inquiryId,
        tenantId: user.tenantId,
        invoiceNumber: validated.invoiceNumber,
        issuedAt: new Date(validated.issuedAt),
        vatRate,
        totalNet,
        totalGross,
        notes: validated.notes,
        invoiceItems: {
          create: validated.items.map((item) => ({
            positionId: item.positionId ?? null,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            notes: item.notes,
          })),
        },
      },
      include: { invoiceItems: true },
    });

    return NextResponse.json({ data: invoice }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 422 });
    }
    console.error(err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
