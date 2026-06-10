import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import { AuditTimeline } from "@/components/dashboard/AuditTimeline";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function ChronikPage({ params }: Props) {
  const { projectId } = await params;
  const user = await requireTenant();

  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: user.tenantId },
  });
  if (!project) return <p className="text-sm text-red-500">Projekt nicht gefunden.</p>;

  const inquiries = await prisma.inquiry.findMany({
    where: { projectId, tenantId: user.tenantId },
    select: { id: true },
  });
  const inquiryIds = inquiries.map((i) => i.id);

  const logs = await prisma.auditLog.findMany({
    where: {
      tenantId: user.tenantId,
      OR: [
        { entityType: "Project", entityId: projectId },
        { entityType: "Inquiry", entityId: { in: inquiryIds } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Änderungsverlauf</h2>
      <p className="text-sm text-gray-500">
        Revisionssichere Dokumentation aller Aktivitäten für dieses Projekt.
      </p>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <AuditTimeline logs={logs} />
      </div>
    </div>
  );
}
