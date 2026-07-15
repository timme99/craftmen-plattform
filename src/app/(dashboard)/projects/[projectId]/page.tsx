import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import UploadLvButton from "@/components/forms/UploadLvButton";
import InquirySummary from "@/components/dashboard/InquirySummary";
import SendInquiryButton from "@/components/forms/SendInquiryButton";
import ExportPreisspiegelButton from "@/components/forms/ExportPreisspiegelButton";
import ProjectStatusDropdown from "@/components/forms/ProjectStatusDropdown";
import ProjectAutomationActions from "@/components/forms/ProjectAutomationActions";
import AwardProjectForm from "@/components/forms/AwardProjectForm";
import ExtractionStatusWatcher from "@/components/dashboard/ExtractionStatusWatcher";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectDetailPage({ params }: Props) {
  const { projectId } = await params;
  const user = await requireTenant();

  const [project, allSuppliers] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, tenantId: user.tenantId },
      include: {
        leistungsverzeichnis: { orderBy: { createdAt: "desc" } },
        inquiries: {
          include: { supplier: true, offers: true },
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

  const pendingLvIds = project.leistungsverzeichnis
    .filter((lv) => lv.extractionStatus === "PENDING" || lv.extractionStatus === "PROCESSING")
    .map((lv) => lv.id);

  const lvStatusLabels: Record<string, string> = {
    PENDING:    "Ausstehend",
    PROCESSING: "Wird verarbeitet",
    COMPLETED:  "Fertig",
    FAILED:     "Fehler",
  };

  const inquiryStatusLabels: Record<string, string> = {
    DRAFT:          "Entwurf",
    SENT:           "Gesendet",
    OPENED:         "Geöffnet",
    OFFER_RECEIVED: "Angebot erhalten",
    DECLINED:       "Abgelehnt",
    EXPIRED:        "Abgelaufen",
  };

  const offerCount = project.inquiries.filter(
    (i) => i.status === "OFFER_RECEIVED"
  ).length;

  const hasOffers = offerCount > 0;

  const offerOptions = project.inquiries
    .filter((i) => i.offers.length > 0)
    .map((i) => ({
      id: i.id,
      supplier: i.supplier.companyName,
      totalNet: Number(i.offers[0].totalNet ?? 0),
    }))
    .sort((a, b) => a.totalNet - b.totalNet);

  const timeline = project.inquiries.flatMap((i) => ([
    { at: i.createdAt, label: `Anfrage erstellt: ${i.supplier.companyName}` },
    i.sentAt ? { at: i.sentAt, label: `Anfrage gesendet: ${i.supplier.companyName}` } : null,
    i.portalOpenedAt ? { at: i.portalOpenedAt, label: `Portal geöffnet: ${i.supplier.companyName}` } : null,
  ])).filter(Boolean).sort((a, b) => +new Date(b!.at) - +new Date(a!.at)) as Array<{at: Date; label: string}>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          {project.location && (
            <p className="text-sm text-gray-500 mt-1">{project.location}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <ProjectStatusDropdown projectId={project.id} currentStatus={project.status} />
          {hasOffers && <ExportPreisspiegelButton projectId={project.id} />}
          <SendInquiryButton projectId={project.id} suppliers={allSuppliers} />
          <ProjectAutomationActions />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "LV hochgeladen", value: project.leistungsverzeichnis.length },
          {
            label: "Anfragen gesendet",
            value: project.inquiries.filter((i) => i.status !== "DRAFT").length,
          },
          { label: "Angebote erhalten", value: offerCount },
          { label: "Lieferanten angefragt", value: project.inquiries.length },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-2xl font-bold text-green-700">{kpi.value}</p>
            <p className="text-xs text-gray-500 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      <ExtractionStatusWatcher projectId={project.id} pendingLvIds={pendingLvIds} />

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Leistungsverzeichnisse</h2>
          <UploadLvButton projectId={project.id} />
        </div>
        {project.leistungsverzeichnis.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            Noch kein LV hochgeladen. Lade ein PDF hoch, um Positionen zu extrahieren.
          </p>
        ) : (
          <ul className="space-y-2">
            {project.leistungsverzeichnis.map((lv) => (
              <li key={lv.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 text-sm">
                <Link
                  href={`/projects/${project.id}/leistungsverzeichnis`}
                  className="font-medium truncate hover:text-green-800 hover:underline"
                >
                  {lv.fileName}
                </Link>
                <span
                  className={`ml-3 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                    lv.extractionStatus === "COMPLETED"
                      ? "bg-green-100 text-green-700"
                      : lv.extractionStatus === "FAILED"
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {lvStatusLabels[lv.extractionStatus] ?? lv.extractionStatus}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <AwardProjectForm projectId={project.id} options={offerOptions} />
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold mb-2">Lieferanten-Performance</h3>
          <ul className="text-sm space-y-1">
            {project.inquiries.map((i) => (
              <li key={i.id} className="flex justify-between">
                <span>{i.supplier.companyName}</span>
                <span className="text-gray-500">{inquiryStatusLabels[i.status] ?? i.status}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-4">
        <h3 className="font-semibold mb-2">Kommunikations-Timeline</h3>
        <ul className="text-sm space-y-1">
          {timeline.slice(0, 12).map((t, idx) => (
            <li key={idx} className="flex justify-between">
              <span>{t.label}</span>
              <span className="text-gray-500">{new Date(t.at).toLocaleDateString("de-DE")}</span>
            </li>
          ))}
        </ul>
      </div>

      <InquirySummary inquiries={project.inquiries} />
    </div>
  );
}
