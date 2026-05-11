import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import EmailScannerButton from "@/components/forms/EmailScannerButton";
import SendInquiryButton from "@/components/forms/SendInquiryButton";
import OfferDetailModal from "@/components/dashboard/OfferDetailModal";
import { Send, Clock, CheckCircle, X, Users } from "lucide-react";

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
            offers: { orderBy: { createdAt: "desc" }, take: 1 },
          },
          orderBy: { createdAt: "desc" },
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
          <EmailScannerButton />
          <SendInquiryButton projectId={project.id} suppliers={allSuppliers} />
        </div>
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
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell text-right font-medium text-gray-900">
                      {offer?.totalNet ? `${fmt(offer.totalNet)} €` : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right">
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
