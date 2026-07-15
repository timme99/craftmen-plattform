import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import { sendInquiryEmail } from "@/lib/graph/client";
import { getGraphAccess } from "@/lib/graph/token";
import { escapeHtml } from "@/lib/security";

export const maxDuration = 10;

const BATCH_LIMIT = 20;

export async function POST(req: NextRequest) {
  try {
    const user = await requireTenant();
    const { dryRun = false } = (await req.json().catch(() => ({}))) as { dryRun?: boolean };

    const graphAccess = await getGraphAccess(user.tenantId);

    if (!graphAccess) {
      return NextResponse.json({ error: "Kein E-Mail Konto verbunden" }, { status: 400 });
    }

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const dueInquiries = await prisma.inquiry.findMany({
      where: {
        tenantId: user.tenantId,
        status: { in: ["SENT", "OPENED"] },
        deadline: { gte: now, lte: in7Days },
      },
      include: { supplier: true, project: true },
      take: BATCH_LIMIT,
      orderBy: { deadline: "asc" },
    });

    if (dryRun) {
      return NextResponse.json({ reminded: 0, candidates: dueInquiries.length, dryRun: true });
    }

    const levelCounts = { warn7: 0, remind3: 0, escalate1: 0 };

    const results = await Promise.allSettled(
      dueInquiries.map((inq) => {
        const msLeft = (inq.deadline?.getTime() ?? now.getTime()) - now.getTime();
        const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
        const stage = daysLeft <= 1 ? "escalate1" : daysLeft <= 3 ? "remind3" : "warn7";
        if (stage === "escalate1") levelCounts.escalate1++;
        if (stage === "remind3") levelCounts.remind3++;
        if (stage === "warn7") levelCounts.warn7++;

        const prefix = stage === "escalate1" ? "Eskalation" : stage === "remind3" ? "Erinnerung" : "Vorwarnung";

        return sendInquiryEmail(graphAccess.accessToken, {
          from: graphAccess.emailAddress,
          to: inq.supplier.email,
          subject: `${prefix}: Angebotsfrist ${inq.project.name}`,
          bodyHtml: `<p>${prefix} zur Angebotsabgabe für <strong>${escapeHtml(inq.project.name)}</strong>.</p><p>Frist: <strong>${inq.deadline?.toLocaleDateString("de-DE") ?? "offen"}</strong></p>`,
        })
      })
    );

    const reminded = results.filter((r) => r.status === "fulfilled").length;
    return NextResponse.json({ reminded, failed: results.length - reminded, scanned: dueInquiries.length, levelCounts });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Reminder failed" }, { status: 500 });
  }
}
