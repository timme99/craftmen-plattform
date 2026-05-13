import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import { sendInquiryEmail } from "@/lib/graph/client";

export const maxDuration = 10;

const BATCH_LIMIT = 20;

export async function POST(req: NextRequest) {
  try {
    const user = await requireTenant();
    const { dryRun = false } = (await req.json().catch(() => ({}))) as { dryRun?: boolean };

    const emailConn = await prisma.emailConnection.findUnique({ where: { tenantId: user.tenantId } });

    if (!emailConn?.accessToken || !emailConn.emailAddress) {
      return NextResponse.json({ error: "Kein E-Mail Konto verbunden" }, { status: 400 });
    }

    const now = new Date();
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const dueInquiries = await prisma.inquiry.findMany({
      where: {
        tenantId: user.tenantId,
        status: { in: ["SENT", "OPENED"] },
        deadline: { gte: now, lte: in3Days },
      },
      include: { supplier: true, project: true },
      take: BATCH_LIMIT,
      orderBy: { deadline: "asc" },
    });

    if (dryRun) {
      return NextResponse.json({ reminded: 0, candidates: dueInquiries.length, dryRun: true });
    }

    const results = await Promise.allSettled(
      dueInquiries.map((inq) =>
        sendInquiryEmail(emailConn.accessToken!, {
          from: emailConn.emailAddress!,
          to: inq.supplier.email,
          subject: `Erinnerung: Angebotsfrist ${inq.project.name}`,
          bodyHtml: `<p>Freundliche Erinnerung zur Angebotsabgabe für <strong>${inq.project.name}</strong>.</p>`,
        })
      )
    );

    const reminded = results.filter((r) => r.status === "fulfilled").length;
    return NextResponse.json({ reminded, failed: results.length - reminded, scanned: dueInquiries.length });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Reminder failed" }, { status: 500 });
  }
}
