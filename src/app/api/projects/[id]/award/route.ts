import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import { sendInquiryEmail } from "@/lib/graph/client";
import { getGraphAccess } from "@/lib/graph/token";
import { escapeHtml } from "@/lib/security";
import { logAudit } from "@/lib/audit";

export const maxDuration = 10;

interface Params {
  params: Promise<{ id: string }>;
}

const EMAIL_LIMIT = 25;

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireTenant();
    const { id: projectId } = await params;
    const { winningInquiryId, decisionNote, notifySuppliers = true } = (await req.json()) as {
      winningInquiryId?: string;
      decisionNote?: string;
      notifySuppliers?: boolean;
    };

    if (!winningInquiryId) {
      return NextResponse.json({ error: "winningInquiryId required" }, { status: 400 });
    }

    const project = await prisma.project.findFirst({ where: { id: projectId, tenantId: user.tenantId } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const inquiries = await prisma.inquiry.findMany({
      where: { projectId, tenantId: user.tenantId },
      include: { supplier: true, offers: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    if (inquiries.length === 0) {
      return NextResponse.json({ error: "No inquiries found for project" }, { status: 400 });
    }

    const winner = inquiries.find((i) => i.id === winningInquiryId);
    if (!winner) return NextResponse.json({ error: "Winner inquiry not found" }, { status: 404 });
    if (!winner.offers.length) {
      return NextResponse.json({ error: "Winner must have at least one offer" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    await prisma.$transaction(async (tx) => {
      await tx.project.update({ where: { id: projectId }, data: { status: "AWARDED" } });

      for (const inquiry of inquiries) {
        await tx.inquiry.update({
          where: { id: inquiry.id },
          data: {
            notes:
              inquiry.id === winningInquiryId
                ? `VERGEBEN am ${nowIso}${decisionNote ? ` | ${decisionNote}` : ""}`
                : `ABGESAGT am ${nowIso}${decisionNote ? ` | ${decisionNote}` : ""}`,
            status: inquiry.id === winningInquiryId ? "OFFER_RECEIVED" : "DECLINED",
          },
        });
      }
    });

    await logAudit(user.tenantId, user.id, "PROJECT_AWARDED", "Project", projectId, {
      winningInquiryId,
      decisionNote,
      totalInquiries: inquiries.length,
    });

    if (!notifySuppliers) {
      return NextResponse.json({ success: true, notified: 0, skippedEmail: true });
    }

    const graphAccess = await getGraphAccess(user.tenantId);
    if (!graphAccess) {
      return NextResponse.json({ success: true, notified: 0, skippedEmail: true });
    }

    const recipients = inquiries.slice(0, EMAIL_LIMIT);
    const results = await Promise.allSettled(
      recipients.map((inquiry) => {
        const isWinner = inquiry.id === winningInquiryId;
        const projectName = escapeHtml(project.name);
        const bodyHtml = isWinner
          ? `<p>Vielen Dank für Ihr Angebot.</p><p>Wir haben Ihr Angebot für das Projekt <strong>${projectName}</strong> ausgewählt.</p>`
          : `<p>Vielen Dank für Ihr Angebot.</p><p>Für das Projekt <strong>${projectName}</strong> haben wir uns für einen anderen Anbieter entschieden.</p>`;
        return sendInquiryEmail(graphAccess.accessToken, {
          from: graphAccess.emailAddress,
          to: inquiry.supplier.email,
          subject: isWinner ? `Zuschlag: ${project.name}` : `Update zur Anfrage: ${project.name}`,
          bodyHtml,
        });
      })
    );

    const notified = results.filter((r) => r.status === "fulfilled").length;
    return NextResponse.json({ success: true, notified, skipped: Math.max(0, inquiries.length - EMAIL_LIMIT) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Award failed" }, { status: 500 });
  }
}
