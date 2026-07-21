import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { requireTenant } from "@/lib/utils/tenant";
import { sendInquiryEmail } from "@/lib/graph/client";
import { getGraphAccess } from "@/lib/graph/token";
import { escapeHtml } from "@/lib/security";
import { logAudit } from "@/lib/audit";

const createInquirySchema = z.object({
  projectId: z.string().uuid(),
  supplierIds: z.array(z.string().uuid()).min(1),
  deadline: z.string().datetime().optional(),
  customMessage: z.string().optional(),
});

type SendResult = {
  supplierId: string;
  supplierName: string;
  status: "sent" | "failed" | "skipped";
  error?: string;
};

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

    const graphAccess = await getGraphAccess(user.tenantId);

    const suppliers = await prisma.supplier.findMany({
      where: { id: { in: validated.supplierIds }, tenantId: user.tenantId, isActive: true },
    });
    if (suppliers.length !== validated.supplierIds.length) {
      return NextResponse.json({ error: "Ungültige Lieferanten für diesen Mandanten" }, { status: 400 });
    }

    const inquiries = await prisma.$transaction(
      suppliers.map((supplier) =>
        prisma.inquiry.upsert({
          where: { projectId_supplierId: { projectId: validated.projectId, supplierId: supplier.id } },
          create: {
            projectId: validated.projectId,
            supplierId: supplier.id,
            tenantId: user.tenantId,
            deadline: validated.deadline ? new Date(validated.deadline) : null,
            status: "DRAFT",
          },
          update: {},
        })
      )
    );

    // Pro Lieferant senden und das Ergebnis festhalten, damit die UI ehrlich
    // anzeigen kann, was gesendet wurde und was nur als Entwurf liegen bleibt.
    const sendResults: SendResult[] = [];

    for (const inquiry of inquiries) {
      const supplier = suppliers.find((s) => s.id === inquiry.supplierId);
      const supplierName = supplier?.companyName ?? inquiry.supplierId;

      if (!graphAccess) {
        // Kein verbundenes E-Mail-Konto: Anfrage bleibt DRAFT, wird aber gemeldet.
        sendResults.push({ supplierId: inquiry.supplierId, supplierName, status: "skipped" });
        continue;
      }
      if (!supplier) {
        sendResults.push({
          supplierId: inquiry.supplierId,
          supplierName,
          status: "failed",
          error: "Lieferant konnte nicht zugeordnet werden.",
        });
        continue;
      }

      try {
        const assignedPositions = await prisma.inquiryPosition.findMany({
          where: { inquiryId: inquiry.id, inquiry: { tenantId: user.tenantId } },
          include: { position: true },
          orderBy: { position: { sortOrder: "asc" } },
        });

        const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")}/portal/${inquiry.portalToken}`;

        await sendInquiryEmail(graphAccess.accessToken, {
          from: graphAccess.emailAddress,
          to: supplier.email,
          subject: `Anfrage ${project.name} - ${supplier.companyName} - Ref:${inquiry.id}`,
          bodyHtml: buildEmailHtml({
            contactName: supplier.contactName,
            projectName: project.name,
            portalUrl,
            deadline: inquiry.deadline ?? undefined,
            customMessage: validated.customMessage,
            positions: assignedPositions.map((assignment) => assignment.position),
          }),
        });

        await prisma.inquiry.update({
          where: { id: inquiry.id },
          data: { status: "SENT", sentAt: new Date() },
        });

        await logAudit(user.tenantId, user.id, "INQUIRY_SENT", "Inquiry", inquiry.id, {
          supplierId: inquiry.supplierId,
          projectId: validated.projectId,
        });

        sendResults.push({ supplierId: supplier.id, supplierName, status: "sent" });
      } catch (err) {
        console.error("[inquiries] email send failed:", err);
        sendResults.push({
          supplierId: supplier.id,
          supplierName,
          status: "failed",
          error: err instanceof Error ? err.message : "Unbekannter Fehler beim Versand.",
        });
      }
    }

    const email = {
      connected: !!graphAccess,
      sent: sendResults.filter((r) => r.status === "sent").length,
      failed: sendResults.filter((r) => r.status === "failed").length,
      skipped: sendResults.filter((r) => r.status === "skipped").length,
      results: sendResults,
    };

    return NextResponse.json({ data: inquiries, email }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 422 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function buildEmailHtml(params: {
  contactName?: string | null;
  projectName: string;
  portalUrl: string;
  deadline?: Date;
  customMessage?: string;
  positions: Array<{
    positionNumber: string;
    shortText: string;
    quantity: { toString(): string } | null;
    unit: string | null;
  }>;
}) {
  const deadlineText = params.deadline
    ? `<p>Angebotsfrist: <strong>${params.deadline.toLocaleDateString("de-DE")}</strong></p>`
    : "";
  // Persönliche Anrede des Ansprechpartners, wenn er hinterlegt ist –
  // sonst die neutrale, aber natürliche Formanrede.
  const contactName = params.contactName?.trim();
  const greeting = contactName
    ? `Guten Tag ${escapeHtml(contactName)},`
    : "Sehr geehrte Damen und Herren,";
  const positionRows = params.positions
    .map((position) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(position.positionNumber)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(position.shortText)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${escapeHtml(position.quantity?.toString() ?? "—")}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(position.unit ?? "—")}</td>
      </tr>`).join("");
  const positionsTable = `
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 8px; text-align: left; border-bottom: 1px solid #d1d5db;">Pos-Nr</th>
          <th style="padding: 8px; text-align: left; border-bottom: 1px solid #d1d5db;">Beschreibung</th>
          <th style="padding: 8px; text-align: right; border-bottom: 1px solid #d1d5db;">Menge</th>
          <th style="padding: 8px; text-align: left; border-bottom: 1px solid #d1d5db;">Einheit</th>
        </tr>
      </thead>
      <tbody>
        ${positionRows || `<tr><td colspan="4" style="padding: 8px; color: #92400e;">Diesem Lieferanten wurden noch keine Positionen zugewiesen.</td></tr>`}
      </tbody>
    </table>`;

  return `
    <!DOCTYPE html>
    <html lang="de">
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
      <div style="background: #2D6A4F; padding: 20px 30px;">
        <h1 style="color: white; margin: 0; font-size: 22px;">CraftMen Plattform</h1>
      </div>
      <div style="padding: 30px; background: #ffffff;">
        <p>${greeting}</p>
        <p>wir laden Sie ein, ein Angebot für das folgende Projekt abzugeben:</p>
        <p style="font-size: 18px; font-weight: bold; color: #2D6A4F;">${escapeHtml(params.projectName)}</p>
        ${deadlineText}
        ${params.customMessage ? `<p>${escapeHtml(params.customMessage)}</p>` : ""}
        <p>Bitte kalkulieren Sie ausschließlich die folgenden Positionen:</p>
        ${positionsTable}
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
