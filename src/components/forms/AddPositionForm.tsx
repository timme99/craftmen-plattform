"use client";

import { useState } from "react";
import { Plus, X, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import UnitSelect from "@/components/forms/UnitSelect";
import { normalizeUnit } from "@/lib/utils/units";

interface Props {
  leistungsverzeichnisId: string;
}

export default function AddPositionForm({ leistungsverzeichnisId }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ positionNumber: "", shortText: "", unit: "", quantity: "" });
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const quantity = parseFloat(form.quantity);
    const res = await fetch("/api/positions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leistungsverzeichnisId,
        positionNumber: form.positionNumber,
        shortText: form.shortText,
        unit: normalizeUnit(form.unit),
        quantity: Number.isFinite(quantity) ? quantity : null,
      }),
    });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      alert(typeof body?.error === "string" ? body.error : "Position konnte nicht gespeichert werden.");
      return;
    }
    setOpen(false);
    setForm({ positionNumber: "", shortText: "", unit: "", quantity: "" });
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-green-700 hover:text-green-800 font-medium mt-3"
      >
        <Plus className="w-3.5 h-3.5" /> Position hinzufügen
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap gap-2 items-end bg-green-50 p-3 rounded-lg border border-green-200">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">Pos.-Nr.</label>
        <input
          required
          value={form.positionNumber}
          onChange={(e) => setForm({ ...form, positionNumber: e.target.value })}
          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
          placeholder="1.1"
        />
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-40">
        <label className="text-xs text-gray-500">Kurztext</label>
        <input
          required
          value={form.shortText}
          onChange={(e) => setForm({ ...form, shortText: e.target.value })}
          className="border border-gray-300 rounded px-2 py-1 text-sm"
          placeholder="Beschreibung der Position"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">Einheit</label>
        <UnitSelect
          value={form.unit}
          onChange={(unit) => setForm({ ...form, unit })}
          className="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">Menge</label>
        <input
          type="number"
          step="any"
          min="0"
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          className="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
          placeholder="0"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          <Check className="w-3.5 h-3.5" /> Speichern
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex items-center gap-1 border border-gray-300 text-gray-600 px-3 py-1.5 rounded text-sm hover:bg-gray-50"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </form>
  );
}
