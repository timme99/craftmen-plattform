"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Check, X } from "lucide-react";

export interface PositionData {
  id: string;
  positionNumber: string;
  shortText: string;
  unit: string | null;
  quantity: number | null;
}

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

  async function handleSave() {
    setSaving(true);
    const quantity = form.quantity.trim() === "" ? null : parseFloat(form.quantity.replace(",", "."));
    const res = await fetch(`/api/positions/${position.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        positionNumber: form.positionNumber,
        shortText: form.shortText,
        unit: form.unit.trim() === "" ? null : form.unit,
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
          <input
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            className="w-16 border border-gray-300 rounded px-1.5 py-1 text-sm text-right"
            placeholder="m²"
          />
        </td>
        <td className="py-2 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <input
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="w-20 border border-gray-300 rounded px-1.5 py-1 text-sm text-right"
              placeholder="0"
            />
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
    <tr className="hover:bg-gray-50 group">
      <td className="py-2 pr-4 text-gray-500 font-mono text-xs">{position.positionNumber}</td>
      <td className="py-2 pr-4 text-gray-900">{position.shortText}</td>
      <td className="py-2 pr-4 text-right text-gray-500">{position.unit ?? "—"}</td>
      <td className="py-2 text-right text-gray-700 font-medium">
        <div className="flex items-center justify-end gap-1.5">
          <span>{position.quantity != null ? position.quantity.toLocaleString("de-DE") : "—"}</span>
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
