import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import UploadLvButton from "@/components/forms/UploadLvButton";
import DeleteLvButton from "@/components/forms/DeleteLvButton";
import EditablePositionRow from "@/components/forms/EditablePositionRow";
import AddPositionForm from "@/components/forms/AddPositionForm";
import AiRetryExtractionButton from "@/components/forms/AiRetryExtractionButton";
import { FileText, ChevronDown } from "lucide-react";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function PositionenPage({ params }: Props) {
  const { projectId } = await params;
  const user = await requireTenant();

  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: user.tenantId },
    include: {
      leistungsverzeichnis: {
        orderBy: { createdAt: "desc" },
        include: {
          positions: { orderBy: [{ sortOrder: "asc" }, { positionNumber: "asc" }] },
        },
      },
    },
  });

  if (!project) notFound();

  const statusColors: Record<string, string> = {
    PENDING:    "bg-yellow-100 text-yellow-700",
    PROCESSING: "bg-blue-100 text-blue-700",
    COMPLETED:  "bg-green-100 text-green-700",
    FAILED:     "bg-red-100 text-red-700",
  };

  const statusLabels: Record<string, string> = {
    PENDING:    "Ausstehend",
    PROCESSING: "Wird verarbeitet",
    COMPLETED:  "Fertig",
    FAILED:     "Fehler",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Leistungsverzeichnisse</h2>
          <p className="text-sm text-gray-500">
            {project.leistungsverzeichnis.length} LV ·{" "}
            {project.leistungsverzeichnis.reduce((sum, lv) => sum + lv.positions.length, 0)} Positionen
          </p>
        </div>
        <UploadLvButton projectId={project.id} />
      </div>

      {project.leistungsverzeichnis.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white rounded-xl border border-gray-200">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium text-gray-500">Kein LV hochgeladen</p>
          <p className="text-sm mt-1">Lade ein PDF hoch, um Positionen zu extrahieren.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {project.leistungsverzeichnis.map((lv) => (
            <details key={lv.id} className="bg-white rounded-xl border border-gray-200 group" open={lv.extractionStatus === "COMPLETED"}>
              <summary className="flex items-center justify-between p-5 cursor-pointer list-none">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">{lv.fileName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {lv.positions.length} Position{lv.positions.length !== 1 ? "en" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[lv.extractionStatus] ?? "bg-gray-100 text-gray-600"}`}>
                    {statusLabels[lv.extractionStatus] ?? lv.extractionStatus}
                  </span>
                  {lv.extractionStatus === "FAILED" && <AiRetryExtractionButton lvId={lv.id} />}
                  <DeleteLvButton lvId={lv.id} fileName={lv.fileName} />
                  <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" />
                </div>
              </summary>

              <div className="px-5 pb-5 border-t border-gray-100">
                {lv.positions.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">
                    {lv.extractionStatus === "COMPLETED"
                      ? "Keine Positionen extrahiert."
                      : "Extraktion läuft noch…"}
                  </p>
                ) : (
                  <div className="overflow-x-auto mt-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                          <th className="text-left pb-2 pr-4 w-16">Pos.</th>
                          <th className="text-left pb-2 pr-4">Kurztext</th>
                          <th className="text-right pb-2 pr-4 w-20">Einheit</th>
                          <th className="text-right pb-2 w-24">Menge</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {lv.positions.map((pos) => (
                          <EditablePositionRow
                            key={pos.id}
                            position={{
                              id: pos.id,
                              positionNumber: pos.positionNumber,
                              shortText: pos.shortText,
                              unit: pos.unit,
                              quantity: pos.quantity != null ? Number(pos.quantity) : null,
                            }}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <AddPositionForm leistungsverzeichnisId={lv.id} />
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
