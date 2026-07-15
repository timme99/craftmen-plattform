"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Link2, Sparkles } from "lucide-react";

type Supplier = {
  id: string;
  companyName: string;
  email: string;
};

type AssignedSupplier = {
  id: string;
  companyName: string;
};

type Position = {
  id: string;
  positionNumber: string;
  shortText: string;
  quantity: string | null;
  unit: string | null;
  assignedSuppliers: AssignedSupplier[];
};

type Suggestion = {
  positionId: string;
  suggestedSupplierIds: string[];
  reason: string;
  confidence: number;
};

interface Props {
  projectId: string;
  positions: Position[];
  suppliers: Supplier[];
}

export default function PositionAssignmentPanel({ projectId, positions, suppliers }: Props) {
  const router = useRouter();
  const [selectedPositionIds, setSelectedPositionIds] = useState<string[]>([]);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [localPositions, setLocalPositions] = useState(positions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const positionsById = useMemo(() => new Map(localPositions.map((p) => [p.id, p])), [localPositions]);
  const suppliersById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);

  const unassignedPositions = useMemo(
    () => localPositions.filter((position) => position.assignedSuppliers.length === 0),
    [localPositions]
  );

  function togglePosition(positionId: string) {
    setSelectedPositionIds((current) =>
      current.includes(positionId) ? current.filter((id) => id !== positionId) : [...current, positionId]
    );
  }

  async function fetchSuggestions() {
    setAiLoading(true);
    setError("");
    const res = await fetch("/api/ai/assign-positions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    setAiLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === "string" ? body.error : "KI-Vorschläge fehlgeschlagen.");
      return;
    }
    const body = (await res.json()) as { data: { suggestions: Suggestion[] } };
    setSuggestions(body.data.suggestions);
  }

  async function assignPositions(positionIds: string[], overrideSupplierId?: string) {
    const targetSupplier = overrideSupplierId ?? supplierId;
    if (!targetSupplier) {
      setError("Bitte einen Lieferanten auswählen.");
      return;
    }
    if (positionIds.length === 0) {
      setError("Bitte mindestens eine Position auswählen.");
      return;
    }

    setLoading(true);
    setError("");

    const res = await fetch(`/api/projects/${projectId}/inquiries/assign-positions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierId: targetSupplier, positionIds }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Zuordnung konnte nicht gespeichert werden.");
      return;
    }

    const data = (await res.json()) as {
      assignments: Array<{ positionId: string; supplier: AssignedSupplier }>;
    };

    setLocalPositions((current) =>
      current.map((position) => {
        const newAssignments = data.assignments.filter((assignment) => assignment.positionId === position.id);
        if (newAssignments.length === 0) return position;

        const suppliersById = new Map(position.assignedSuppliers.map((supplier) => [supplier.id, supplier]));
        for (const assignment of newAssignments) suppliersById.set(assignment.supplier.id, assignment.supplier);
        return { ...position, assignedSuppliers: Array.from(suppliersById.values()) };
      })
    );
    setSelectedPositionIds([]);
    router.refresh();
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Positionen Lieferanten zuweisen</h3>
          <p className="text-sm text-gray-500">
            {localPositions.length} Positionen · {unassignedPositions.length} noch ohne Lieferant
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <button
            type="button"
            onClick={fetchSuggestions}
            disabled={aiLoading || localPositions.length === 0 || suppliers.length === 0}
            className="inline-flex items-center justify-center gap-2 border border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-50 text-sm font-medium px-3 py-2 rounded-lg"
          >
            <Sparkles className="w-4 h-4" />
            {aiLoading ? "Analysiert…" : "KI-Zuordnung vorschlagen"}
          </button>
          <select
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.companyName}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => assignPositions(selectedPositionIds)}
            disabled={loading || selectedPositionIds.length === 0 || suppliers.length === 0}
            className="inline-flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-medium px-3 py-2 rounded-lg"
          >
            <Link2 className="w-4 h-4" />
            Zu Lieferant zuweisen
          </button>
          <button
            type="button"
            onClick={() => assignPositions(unassignedPositions.map((position) => position.id))}
            disabled={loading || unassignedPositions.length === 0 || suppliers.length === 0}
            className="inline-flex items-center justify-center gap-2 border border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-50 text-sm font-medium px-3 py-2 rounded-lg"
          >
            <CheckSquare className="w-4 h-4" />
            Alle zuweisen
          </button>
        </div>
      </div>

      {error && <p className="m-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {suggestions.length > 0 && (
        <div className="m-4 border border-green-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between bg-green-50 px-4 py-2">
            <p className="text-sm font-semibold text-green-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> KI-Zuordnungsvorschläge
            </p>
            <button onClick={() => setSuggestions([])} className="text-xs text-green-700 hover:text-green-900">
              Schließen
            </button>
          </div>
          <ul className="divide-y divide-gray-100">
            {suggestions.map((suggestion) => {
              const position = positionsById.get(suggestion.positionId);
              const topSupplierId = suggestion.suggestedSupplierIds[0];
              const supplierNames = suggestion.suggestedSupplierIds
                .map((id) => suppliersById.get(id)?.companyName)
                .filter(Boolean)
                .join(", ");
              if (!position || !topSupplierId) return null;
              return (
                <li key={suggestion.positionId} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {position.positionNumber} · {position.shortText}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      → {supplierNames}{" "}
                      <span className="text-gray-400">({Math.round(suggestion.confidence * 100)}%)</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{suggestion.reason}</p>
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={async () => {
                      await assignPositions([suggestion.positionId], topSupplierId);
                      setSuggestions((current) => current.filter((s) => s.positionId !== suggestion.positionId));
                    }}
                    className="shrink-0 inline-flex items-center gap-1.5 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Übernehmen
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="divide-y divide-gray-100">
          {localPositions.length === 0 ? (
            <p className="p-6 text-sm text-gray-400">Noch keine extrahierten Positionen vorhanden.</p>
          ) : (
            localPositions.map((position) => {
              const isUnassigned = position.assignedSuppliers.length === 0;
              return (
                <label
                  key={position.id}
                  className={`flex gap-3 p-4 cursor-pointer hover:bg-gray-50 ${isUnassigned ? "bg-yellow-50" : "bg-white"}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedPositionIds.includes(position.id)}
                    onChange={() => togglePosition(position.id)}
                    className="mt-1 h-4 w-4 accent-green-700"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {position.positionNumber} · {position.shortText}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Menge: {position.quantity ?? "—"} · Einheit: {position.unit ?? "—"}
                        </p>
                      </div>
                      {isUnassigned && (
                        <span className="self-start text-xs font-medium text-yellow-800 bg-yellow-100 px-2 py-1 rounded-full">
                          Nicht zugewiesen
                        </span>
                      )}
                    </div>
                    {position.assignedSuppliers.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {position.assignedSuppliers.map((supplier) => (
                          <span key={supplier.id} className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                            {supplier.companyName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              );
            })
          )}
        </div>

        <aside className="border-t lg:border-t-0 lg:border-l border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-900 mb-3">Lieferanten im Projekt</p>
          {suppliers.length === 0 ? (
            <p className="text-sm text-gray-400">Noch keine aktiven Lieferanten vorhanden.</p>
          ) : (
            <div className="space-y-2">
              {suppliers.map((supplier) => (
                <div key={supplier.id} className="bg-white border border-gray-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-900">{supplier.companyName}</p>
                  <p className="text-xs text-gray-500">{supplier.email}</p>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
