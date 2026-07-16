"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeftRight, Pencil, Trash2, Check, X } from "lucide-react";
import UnitSelect from "@/components/forms/UnitSelect";
import { getPositionWarnings, normalizeUnit } from "@/lib/utils/units";

export interface PositionData {
  id: string;
  positionNumber: string;
  shortText: string;
  unit: string | null;
  quantity: number | null;
  assignedSuppliers?: string[];
}

const NUMBER_LIKE = /^[\d.,\s]+$/;

export default function EditablePositionRow({ position }: { position: PositionData }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    positionNumber: position.positionNumber,
    shortText: position.shortText,
    unit: position.unit ?? "",
    quantity: position.quantity != null ? String(position.quantity) : "",
  });
  const router = useRouter();

  const assignedSuppliers = position.assignedSuppliers ?? [];
  const warnings = getPositionWarnings(position);
  // Klassischer Vertauschungsfall: Zahl im Einheitenfeld, Menge leer
  const canSwap = NUMBER_LIKE.test(form.unit.trim()) && form.unit.trim() !== "" && form.quantity.trim() === "";

  async function handleSave() {
    setSaving(true);
    const quantity = form.quantity.trim() === "" ? null : parseFloat(form.quantity.replace(",", "."));
    const res = await fetch(`/api/positions/${position.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        positionNumber: form.positionNumber,
        shortText: form.shortText,
        unit: normalizeUnit(form.unit),
        quantity: quantity != null && Number.isFinite(quantity) ? quantity : null,
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      alert(typeof body?.error === "string" ? body.error : "Speichern fehlgeschlagen.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`Position ${position.positionNumber} („${position.shortText}") wirklich löschen?`)) return;

    setSaving(true);
    const res = await fetch(`/api/positions/${position.id}`, { method: "DELETE" });
    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      alert(typeof body?.error === "string" ? body.error : "Löschen fehlgeschlagen.");
      return;
    }
    router.refresh();
  }

  if (editing) {
    return (
      <tr className="bg-green-50">
        <td className="py-2 pr-2">
          <input
            value={form.positionNumber}
            onChange={(e) => setForm({ ...form, positionNumber: e.target.value })}
            className="w-16 border border-gray-300 rounded px-1.5 py-1 text-xs font-mono"
          />
        </td>
        <td className="py-2 pr-2">
          <input
            value={form.shortText}
            onChange={(e) => setForm({ ...form, shortText: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </td>
        <td className="py-2 pr-2 text-right">
          <div className="flex items-center justify-end gap-1">
            {canSwap && (
              <button
                type="button"
                onClick={() => setForm({ ...form, unit: form.quantity, quantity: form.unit })}
                title="Einheit und Menge tauschen"
                className="p-1 text-amber-600 hover:bg-amber-100 rounded"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </button>
            )}
            <UnitSelect value={form.unit} onChange={(unit) => setForm({ ...form, unit })} />
          </div>
        </td>
        <td className="py-2 pr-4 text-right">
          <input
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            className="w-20 border border-gray-300 rounded px-1.5 py-1 text-sm text-right"
            placeholder="0"
          />
        </td>
        <td className="py-2 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={handleSave}
              disabled={saving || !form.positionNumber.trim() || !form.shortText.trim()}
              title="Speichern"
              className="p-1 text-green-700 hover:bg-green-100 rounded disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              title="Abbrechen"
              className="p-1 text-gray-500 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className={`group ${warnings.length > 0 ? "bg-amber-50 hover:bg-amber-100" : "hover:bg-gray-50"}`}>
      <td className="py-2 pr-4 text-gray-500 font-mono text-xs">
        <span className="inline-flex items-center gap-1.5">
          {warnings.length > 0 && (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-label={warnings.join(" · ")} />
          )}
          {position.positionNumber}
        </span>
      </td>
      <td className="py-2 pr-4 text-gray-900">{position.shortText}</td>
      <td
        className={`py-2 pr-4 text-right ${warnings.some((w) => w.startsWith("Einheit") || w.startsWith("Unbekannte")) ? "text-amber-700" : "text-gray-500"}`}
        title={warnings.length > 0 ? warnings.join(" · ") : undefined}
      >
        {position.unit ?? "—"}
      </td>
      <td className="py-2 pr-4 text-right text-gray-700 font-medium">
        {position.quantity != null ? position.quantity.toLocaleString("de-DE") : "—"}
      </td>
      <td className="py-2 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {assignedSuppliers.length === 0 ? (
            <span className="text-xs text-gray-400">Nicht zugewiesen</span>
          ) : (
            <span className="flex flex-wrap justify-end gap-1">
              {assignedSuppliers.slice(0, 2).map((name) => (
                <span key={name} className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                  {name}
                </span>
              ))}
              {assignedSuppliers.length > 2 && (
                <span
                  className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full"
                  title={assignedSuppliers.slice(2).join(", ")}
                >
                  +{assignedSuppliers.length - 2}
                </span>
              )}
            </span>
          )}
          <span className="flex opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setEditing(true)}
              title="Position bearbeiten"
              className="p-1 text-gray-400 hover:text-green-700 hover:bg-green-50 rounded"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDelete}
              disabled={saving}
              title="Position löschen"
              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </span>
        </div>
      </td>
    </tr>
  );
}
