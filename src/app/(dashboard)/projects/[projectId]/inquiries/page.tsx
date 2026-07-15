import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import EmailScannerButton from "@/components/forms/EmailScannerButton";
import SendInquiryButton from "@/components/forms/SendInquiryButton";
import PositionAssignmentPanel from "@/components/forms/PositionAssignmentPanel";
import OfferDetailModal from "@/components/dashboard/OfferDetailModal";
import OfferAnalysisButton from "@/components/forms/OfferAnalysisButton";
import AiParseOfferButton from "@/components/forms/AiParseOfferButton";
import { Users } from "lucide-react";

interface Props {
  params: Promise<{ projectId: string }>;
}

const statusLabels: Record<string, string> = {
  DRAFT:          "Entwurf",
  SENT:           "Gesendet",
  OPENED:         "Geöffnet",
  OFFER_RECEIVED: "Angebot erhalten",
  DECLINED:       "Abgelehnt",
  EXPIRED:        "Abgelaufen",
};

const statusColors: Record<string, string> = {
  DRAFT:          "bg-gray-100 text-gray-600",
  SENT:           "bg-blue-100 text-blue-700",
  OPENED:         "bg-purple-100 text-purple-700",
  OFFER_RECEIVED: "bg-green-100 text-green-700",
  DECLINED:       "bg-red-100 text-red-700",
  EXPIRED:        "bg-orange-100 text-orange-700",
};

const fmt = (val: { toString(): string } | null | undefined) =>
  val != null ? Number(val.toString()).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";

function getDeadlinePhase(deadline: Date | null) {
  if (!deadline) return { label: "Keine Frist", color: "text-gray-400" };
  const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { label: `Überfällig (${Math.abs(daysLeft)} Tage)`, color: "text-red-700" };
  if (daysLeft <= 1) return { label: "Eskalation: heute/morgen", color: "text-red-700" };
  if (daysLeft <= 3) return { label: "Reminder: 3 Tage", color: "text-amber-700" };
  if (daysLeft <= 7) return { label: "Vorwarnung: 7 Tage", color: "text-blue-700" };
  return { label: `Noch ${daysLeft} Tage`, color: "text-gray-500" };
}

export default async function AnfragenPage({ params }: Props) {
  const { projectId } = await params;
  const user = await requireTenant();

  const [project, allSuppliers] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, tenantId: user.tenantId },
      include: {
        inquiries: {
          include: {
            supplier: true,
            positions: { include: { position: true } },
            offers: { orderBy: { createdAt: "desc" }, take: 1 },
          },
          orderBy: { createdAt: "desc" },
        },
        leistungsverzeichnis: {
          where: { extractionStatus: "COMPLETED" },
          include: { positions: { orderBy: { sortOrder: "asc" } } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.supplier.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      orderBy: { companyName: "asc" },
    }),
  ]);

  if (!project) notFound();

  const inquiries = project.inquiries;
  const received = inquiries.filter((i) => i.status === "OFFER_RECEIVED").length;
  const positions =(project.leistungsverzeichnis[0]?.positions ?? []).map((position) => ({
    id: position.id,
    positionNumber: position.positionNumber,
    shortText: position.shortText,
    quantity: position.quantity?.toString() ?? null,
    unit: position.unit,
    assignedSuppliers: inquiries
      .filter((inquiry) => inquiry.positions.some((assignment) => assignment.positionId === position.id))
      .map((inquiry) => ({ id: inquiry.supplier.id, companyName: inquiry.supplier.companyName })),
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Lieferantenanfragen</h2>
          <p className="text-sm text-gray-500">
            {inquiries.length} Anfragen · {received} Angebote erhalten
          </p>
        </div>
        <div className="flex items-center gap-3">
          {received > 0 && <OfferAnalysisButton projectId={project.id} />}
          <EmailScannerButton />
          <SendInquiryButton projectId={project.id} suppliers={allSuppliers} />
        </div>
      </div>

      <PositionAssignmentPanel projectId={project.id} positions={positions} suppliers={allSuppliers} />

      <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-700">
        <p className="font-semibold text-gray-900 mb-2">Reminder-Timeline</p>
        <p>Automatische Staffelung: Vorwarnung 7 Tage vor Frist, Reminder 3 Tage vor Frist, Eskalation 1 Tag vor Frist bzw. am Fristtag.</p>
      </div>

      {inquiries.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white rounded-xl border border-gray-200">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium text-gray-500">Keine Anfragen</p>
          <p className="text-sm mt-1">Sende Anfragen an Lieferanten, um Angebote zu erhalten.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3">Lieferant</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Versendet</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Frist</th>
                <th className="text-right px-4 py-3 hidden md:table-cell">Angebotssumme</th>
                <th className="text-right px-5 py-3">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {inquiries.map((inq) => {
                const offer = inq.offers[0];
                return (
                  <tr key={inq.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900">{inq.supplier.companyName}</p>
                      <p className="text-xs text-gray-400">{inq.supplier.email}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[inq.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {statusLabels[inq.status] ?? inq.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell text-gray-500">
                      {inq.sentAt ? new Date(inq.sentAt).toLocaleDateString("de-DE") : "—"}
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell text-gray-500">
                      {inq.deadline ? new Date(inq.deadline).toLocaleDateString("de-DE") : "—"}
                      <p className={`text-xs mt-0.5 ${getDeadlinePhase(inq.deadline).color}`}>{getDeadlinePhase(inq.deadline).label}</p>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell text-right font-medium text-gray-900">
                      {offer?.totalNet ? `${fmt(offer.totalNet)} €` : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {inq.status === "OFFER_RECEIVED" && (
                          <OfferDetailModal inquiryId={inq.id} supplierName={inq.supplier.companyName} />
                        )}
                        {(inq.status === "SENT" || inq.status === "OPENED") && (
                          <a
                            href={`/portal/${inq.portalToken}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded border border-blue-200 hover:bg-blue-50"
                          >
                            Portal öffnen
                          </a>
                        )}
                        {inq.emailMessageId && inq.offers.length === 0 && (
                          <AiParseOfferButton inquiryId={inq.id} />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
