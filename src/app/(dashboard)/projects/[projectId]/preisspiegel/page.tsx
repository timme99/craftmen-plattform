import { Fragment } from "react";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import ExportPreisspiegelButton from "@/components/forms/ExportPreisspiegelButton";
import { BarChart2 } from "lucide-react";

interface Props {
  params: Promise<{ projectId: string }>;
}

const fmt = (val: string | null | undefined) =>
  val != null ? Number(val).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";

export default async function PreisspiegelPage({ params }: Props) {
  const { projectId } = await params;
  const user = await requireTenant();

  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: user.tenantId },
    include: {
      leistungsverzeichnis: {
        where: { extractionStatus: "COMPLETED" },
        include: {
          positions: { orderBy: [{ sortOrder: "asc" }, { positionNumber: "asc" }] },
        },
      },
      inquiries: {
        where: { status: "OFFER_RECEIVED" },
        include: {
          supplier: true,
          offers: {
            include: { offerItems: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!project) notFound();

  const positions = project.leistungsverzeichnis.flatMap((lv) => lv.positions);
  const suppliers = project.inquiries
    .filter((inq) => inq.offers.length > 0)
    .map((inq) => ({
      id: inq.supplierId,
      companyName: inq.supplier.companyName,
      totalNet: inq.offers[0].totalNet?.toString() ?? null,
      items: Object.fromEntries(
        inq.offers[0].offerItems.map((item) => [
          item.positionId,
          { unitPrice: item.unitPrice?.toString() ?? null, totalPrice: item.totalPrice?.toString() ?? null },
        ])
      ),
    }));

  const totalInquiries = project.inquiries.length;

  const coverageByPosition = positions.map((pos) => {
    const offeredCount = suppliers.filter((sup) => sup.items[pos.id]?.totalPrice != null).length;
    return {
      positionId: pos.id,
      offeredCount,
      missingCount: suppliers.length - offeredCount,
      coveragePercent: suppliers.length > 0 ? Math.round((offeredCount / suppliers.length) * 100) : 0,
    };
  });

  const missingPositions = coverageByPosition.filter((c) => c.missingCount > 0);
  const criticalMissingPositions = coverageByPosition.filter((c) => c.coveragePercent < 50).length;
  const coverageMap = Object.fromEntries(coverageByPosition.map((c) => [c.positionId, c.coveragePercent]));

  const outlierWarnings = positions.flatMap((pos) => {
    const prices = suppliers
      .map((sup) => ({ supplier: sup.companyName, value: sup.items[pos.id]?.totalPrice }))
      .filter((p): p is { supplier: string; value: string } => p.value != null)
      .map((p) => ({ supplier: p.supplier, value: Number(p.value) }))
      .filter((p) => Number.isFinite(p.value) && p.value > 0);

    if (prices.length < 3) return [];
    const sorted = [...prices].sort((a, b) => a.value - b.value);
    const median = sorted[Math.floor(sorted.length / 2)].value;
    return prices
      .filter((p) => p.value > median * 1.35)
      .map((p) => ({ positionNumber: pos.positionNumber, supplier: p.supplier, deltaPct: Math.round(((p.value / median) - 1) * 100) }));
  });
  const strongestOutliers = [...outlierWarnings].sort((a, b) => b.deltaPct - a.deltaPct).slice(0, 3);

  // Find cheapest supplier per position
  const cheapestByPosition: Record<string, string> = {};
  for (const pos of positions) {
    let min: number | null = null;
    let minSupplierId = "";
    for (const sup of suppliers) {
      const tp = sup.items[pos.id]?.totalPrice;
      if (tp != null) {
        const n = Number(tp);
        if (min === null || n < min) { min = n; minSupplierId = sup.id; }
      }
    }
    if (minSupplierId) cheapestByPosition[pos.id] = minSupplierId;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Preisspiegel</h2>
          <p className="text-sm text-gray-500">
            {suppliers.length} von {totalInquiries} Lieferanten haben geantwortet
          </p>
        </div>
        {suppliers.length > 0 && <ExportPreisspiegelButton projectId={project.id} />}
      </div>

      {(missingPositions.length > 0 || outlierWarnings.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 space-y-2">
          <p className="font-semibold">Automatische Qualitätswarnungen</p>
          {missingPositions.length > 0 && (
            <p>
              Fehlende Positionspreise: <strong>{missingPositions.length}</strong> von {positions.length} Positionen sind nicht vollständig bepreist.
            </p>
          )}
          {outlierWarnings.length > 0 && (
            <p>
              Preis-Ausreißer erkannt: <strong>{outlierWarnings.length}</strong> Positionen liegen über 35% über dem Median.
            </p>
          )}
          {criticalMissingPositions > 0 && (
            <p>
              Kritisch unvollständig: <strong>{criticalMissingPositions}</strong> Positionen haben weniger als 50% Preisabdeckung.
            </p>
          )}
          {strongestOutliers.length > 0 && (
            <ul className="list-disc ml-4">
              {strongestOutliers.map((warn) => (
                <li key={`${warn.positionNumber}-${warn.supplier}`}>
                  Pos. {warn.positionNumber}: {warn.supplier} liegt {warn.deltaPct}% über Median.
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {suppliers.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white rounded-xl border border-gray-200">
          <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium text-gray-500">Noch keine Angebote</p>
          <p className="text-sm mt-1">Der Preisspiegel wird erstellt, sobald Lieferanten Angebote einreichen.</p>
        </div>
      ) : positions.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white rounded-xl border border-gray-200">
          <p className="text-sm">Keine extrahierten Positionen vorhanden.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide w-16 sticky left-0 bg-gray-50">Pos.</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide sticky left-16 bg-gray-50 min-w-48">Kurztext</th>
                <th className="text-right px-3 py-3 text-xs text-gray-500 uppercase tracking-wide w-16">Einh.</th>
                <th className="text-right px-3 py-3 text-xs text-gray-500 uppercase tracking-wide w-20">Menge</th>
                {suppliers.map((sup) => (
                  <th key={sup.id} colSpan={2} className="text-center px-3 py-3 text-xs text-gray-700 font-semibold border-l border-gray-200 min-w-40">
                    {sup.companyName}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th colSpan={4} />
                {suppliers.map((sup) => (
                  <Fragment key={sup.id}>
                    <th className="text-right px-3 py-1.5 text-xs text-gray-400 border-l border-gray-200 w-24">EP (€)</th>
                    <th className="text-right px-3 py-1.5 text-xs text-gray-400 w-24">GP (€)</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {positions.map((pos) => (
                <tr key={pos.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-xs text-gray-400 font-mono sticky left-0 bg-white">{pos.positionNumber}</td>
                  <td className="px-4 py-2.5 text-gray-800 sticky left-16 bg-white">
                    {pos.shortText}
                    {(coverageMap[pos.id] ?? 100) < 100 && (
                      <span className="ml-2 text-[11px] text-amber-700">({coverageMap[pos.id]}% Abdeckung)</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-500">{pos.unit ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">{pos.quantity ? Number(pos.quantity).toLocaleString("de-DE") : "—"}</td>
                  {suppliers.map((sup) => {
                    const item = sup.items[pos.id];
                    const isCheapest = cheapestByPosition[pos.id] === sup.id;
                    return (
                      <Fragment key={sup.id}>
                        <td className={`px-3 py-2.5 text-right border-l border-gray-100 ${isCheapest ? "text-green-700" : "text-gray-700"}`}>
                          {fmt(item?.unitPrice)}
                        </td>
                        <td className={`px-3 py-2.5 text-right font-medium ${isCheapest ? "bg-green-50 text-green-800" : "text-gray-800"}`}>
                          {fmt(item?.totalPrice)}
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                <td colSpan={4} className="px-4 py-3 text-sm text-gray-700">Gesamt Netto</td>
                {suppliers.map((sup) => (
                  <Fragment key={sup.id}>
                    <td className="border-l border-gray-200" />
                    <td className="px-3 py-3 text-right text-sm text-green-800">
                      {sup.totalNet ? `${fmt(sup.totalNet)} €` : "—"}
                    </td>
                  </Fragment>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
