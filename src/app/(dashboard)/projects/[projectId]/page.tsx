import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import ProjectStatusBadge from "@/components/dashboard/ProjectStatusBadge";
import UploadLvButton from "@/components/forms/UploadLvButton";
import InquirySummary from "@/components/dashboard/InquirySummary";
import SendInquiryButton from "@/components/forms/SendInquiryButton";
import ExportPreisspiegelButton from "@/components/forms/ExportPreisspiegelButton";
import ProjectStatusDropdown from "@/components/forms/ProjectStatusDropdown";

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

  const offerCount = project.inquiries.filter(
    (i) => i.status === "OFFER_RECEIVED"
  ).length;

  const hasOffers = offerCount > 0;

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
                <span className="font-medium truncate">{lv.fileName}</span>
                <span
                  className={`ml-3 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                    lv.extractionStatus === "COMPLETED"
                      ? "bg-green-100 text-green-700"
                      : lv.extractionStatus === "FAILED"
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {lv.extractionStatus}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <InquirySummary projectId={project.id} inquiries={project.inquiries} />
    </div>
  );
}
