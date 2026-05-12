import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { requireTenant } from "@/lib/utils/tenant";
import { sendInquiryEmail } from "@/lib/graph/client";

const createInquirySchema = z.object({
  projectId: z.string().uuid(),
  supplierIds: z.array(z.string().uuid()).min(1),
  deadline: z.string().datetime().optional(),
  customMessage: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireTenant();
    const body = await req.json();
    const validated = createInquirySchema.parse(body);

    const project = await prisma.project.findFirst({
      where: { id: validated.projectId, tenantId: user.tenantId },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const emailConn = await prisma.emailConnection.findUnique({
      where: { tenantId: user.tenantId },
    });

    const inquiries = await prisma.$transaction(
      validated.supplierIds.map((supplierId) =>
        prisma.inquiry.upsert({
          where: { projectId_supplierId: { projectId: validated.projectId, supplierId } },
          create: {
            projectId: validated.projectId,
            supplierId,
            tenantId: user.tenantId,
            deadline: validated.deadline ? new Date(validated.deadline) : null,
            status: "DRAFT",
          },
          update: {},
        })
      )
    );

    // Send emails if Microsoft Graph is connected
    if (emailConn?.accessToken && emailConn.emailAddress) {
      const suppliers = await prisma.supplier.findMany({
        where: { id: { in: validated.supplierIds }, tenantId: user.tenantId },
      });

      await Promise.allSettled(
        inquiries.map(async (inquiry) => {
          const supplier = suppliers.find((s) =>
            validated.supplierIds.includes(s.id)
          );
          if (!supplier) return;

          const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/${inquiry.portalToken}`;

          await sendInquiryEmail(emailConn.accessToken!, {
            from: emailConn.emailAddress!,
            to: supplier.email,
            subject: `Angebotsanfrage: ${project.name}`,
            bodyHtml: buildEmailHtml({
              supplierName: supplier.companyName,
              projectName: project.name,
              portalUrl,
              deadline: inquiry.deadline ?? undefined,
              customMessage: validated.customMessage,
            }),
          });

          await prisma.inquiry.update({
            where: { id: inquiry.id },
            data: { status: "SENT", sentAt: new Date() },
          });
        })
      );
    }

    return NextResponse.json({ data: inquiries }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 422 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function buildEmailHtml(params: {
  supplierName: string;
  projectName: string;
  portalUrl: string;
  deadline?: Date;
  customMessage?: string;
}) {
  const deadlineText = params.deadline
    ? `<p>Angebotsfrist: <strong>${params.deadline.toLocaleDateString("de-DE")}</strong></p>`
    : "";

  return `
    <!DOCTYPE html>
    <html lang="de">
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
      <div style="background: #2D6A4F; padding: 20px 30px;">
        <h1 style="color: white; margin: 0; font-size: 22px;">CraftMen Plattform</h1>
      </div>
      <div style="padding: 30px; background: #ffffff;">
        <p>Sehr geehrte Damen und Herren von <strong>${params.supplierName}</strong>,</p>
        <p>wir laden Sie ein, ein Angebot für das folgende Projekt abzugeben:</p>
        <p style="font-size: 18px; font-weight: bold; color: #2D6A4F;">${params.projectName}</p>
        ${deadlineText}
        ${params.customMessage ? `<p>${params.customMessage}</p>` : ""}
        <p>Bitte klicken Sie auf den folgenden Button, um Ihr Angebot direkt einzugeben:</p>
        <a href="${params.portalUrl}" style="display: inline-block; background: #2D6A4F; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
          Angebot abgeben →
        </a>
        <p style="font-size: 12px; color: #6b7280; margin-top: 24px;">
          Alternativ können Sie uns Ihr Angebot auch per E-Mail zusenden.
        </p>
      </div>
      <div style="background: #f9fafb; padding: 16px 30px; border-top: 1px solid #e5e7eb;">
        <p style="font-size: 11px; color: #9ca3af; margin: 0;">
          Diese E-Mail wurde automatisch über die CraftMen Plattform versendet.
        </p>
      </div>
    </body>
    </html>
  `;
}
