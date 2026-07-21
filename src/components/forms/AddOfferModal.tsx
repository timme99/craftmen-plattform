"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Upload, Loader2, AlertCircle, CheckCircle } from "lucide-react";

interface PositionLite {
  id: string;
  positionNumber: string;
  shortText: string;
  unit: string | null;
  quantity: string | null;
}

interface SupplierLite {
  id: string;
  companyName: string;
  email: string;
}

interface Props {
  projectId: string;
  suppliers: SupplierLite[];
  positions: PositionLite[];
}

const NEW_SUPPLIER = "__new__";

// Wandelt eine Nutzereingabe (deutsches oder englisches Zahlenformat) in eine Zahl.
function parsePrice(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export default function AddOfferModal({ projectId, suppliers, positions }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [supplierId, setSupplierId] = useState<string>(suppliers[0]?.id ?? NEW_SUPPLIER);
  const [newCompany, setNewCompany] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [vatRate, setVatRate] = useState("19");
  const [notes, setNotes] = useState("");

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [parseInfo, setParseInfo] = useState<{
    fileName: string;
    matchedCount: number;
    extractedCount: number;
    matchRate: number;
    confidenceLabel: string;
    unmatched: { positionNumber: string; shortText: string }[];
  } | null>(null);

  const totalNet = useMemo(() => {
    return positions.reduce((sum, pos) => {
      const price = parsePrice(prices[pos.id] ?? "");
      if (price == null) return sum;
      const qty = pos.quantity != null ? Number(pos.quantity) : 1;
      return sum + price * (qty || 1);
    }, 0);
  }, [prices, positions]);

  const filledCount = positions.filter((p) => parsePrice(prices[p.id] ?? "") != null).length;

  function reset() {
    setPrices({});
    setNotes("");
    setVatRate("19");
    setNewCompany("");
    setNewEmail("");
    setSupplierId(suppliers[0]?.id ?? NEW_SUPPLIER);
    setError("");
    setParseInfo(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setError("");
    setParseInfo(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("projectId", projectId);

    try {
      const res = await fetch("/api/offers/parse-upload", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "PDF konnte nicht ausgelesen werden.");
        return;
      }
      const data = body.data as {
        fileName: string;
        extractedCount: number;
        matchedCount: number;
        matchRate: number;
        confidenceLabel: string;
        items: { positionId: string; unitPrice: number | null }[];
        unmatched: { positionNumber: string; shortText: string }[];
      };

      // Ausgelesene Einzelpreise in die Preistabelle übernehmen (überschreibt Vorhandenes).
      setPrices((prev) => {
        const next = { ...prev };
        for (const item of data.items) {
          if (item.unitPrice != null) {
            next[item.positionId] = item.unitPrice.toLocaleString("de-DE", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
          }
        }
        return next;
      });
      setParseInfo({
        fileName: data.fileName,
        matchedCount: data.matchedCount,
        extractedCount: data.extractedCount,
        matchRate: data.matchRate,
        confidenceLabel: data.confidenceLabel,
        unmatched: data.unmatched,
      });
    } catch {
      setError("Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setError("");

    const items = positions
      .map((pos) => ({ positionId: pos.id, unitPrice: parsePrice(prices[pos.id] ?? "") }))
      .filter((i): i is { positionId: string; unitPrice: number } => i.unitPrice != null);

    if (items.length === 0) {
      setError("Bitte mindestens einen Einzelpreis eingeben.");
      return;
    }

    const payload: Record<string, unknown> = {
      projectId,
      items,
      vatRate: Number(vatRate) || 0,
      notes: notes.trim() || undefined,
    };

    if (supplierId === NEW_SUPPLIER) {
      if (!newCompany.trim() || !newEmail.trim()) {
        setError("Bitte Firmenname und E-Mail des neuen Lieferanten angeben.");
        return;
      }
      payload.newSupplier = { companyName: newCompany.trim(), email: newEmail.trim() };
    } else {
      payload.supplierId = supplierId;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/offers/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Angebot konnte nicht gespeichert werden.");
        return;
      }
      close();
      router.refresh();
    } catch {
      setError("Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        Angebot hinzufügen
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="mt-8 w-full max-w-3xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Angebot hinzufügen</h3>
            <p className="text-xs text-gray-500">
              Preise manuell erfassen oder ein Angebots-PDF hochladen und die Werte prüfen.
            </p>
          </div>
          <button onClick={close} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
          {/* Lieferant */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Lieferant</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.companyName} ({s.email})
                </option>
              ))}
              <option value={NEW_SUPPLIER}>+ Neuer Lieferant …</option>
            </select>
            {supplierId === NEW_SUPPLIER && (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  placeholder="Firmenname"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                />
                <input
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="E-Mail"
                  type="email"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* PDF-Upload */}
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-gray-600">
                <p className="font-medium text-gray-800">Angebots-PDF hochladen (optional)</p>
                <p className="text-xs text-gray-500">Preise werden per KI ausgelesen und unten vorausgefüllt.</p>
              </div>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Liest aus…" : "PDF wählen"}
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>

            {parseInfo && (
              <div className="mt-3 space-y-2 text-xs">
                <p className="flex items-center gap-1.5 text-green-700">
                  <CheckCircle className="h-4 w-4" />
                  {parseInfo.fileName}: {parseInfo.matchedCount}/{parseInfo.extractedCount} Positionen zugeordnet ·
                  Import-Ampel <strong>{parseInfo.confidenceLabel}</strong> ({parseInfo.matchRate}%)
                </p>
                {parseInfo.unmatched.length > 0 && (
                  <p className="text-amber-700">
                    {parseInfo.unmatched.length} ausgelesene Position(en) ohne Zuordnung — bitte manuell prüfen:{" "}
                    {parseInfo.unmatched.slice(0, 5).map((u) => u.positionNumber).join(", ")}
                    {parseInfo.unmatched.length > 5 ? " …" : ""}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Preistabelle */}
          {positions.length === 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Für dieses Projekt sind noch keine LV-Positionen extrahiert. Bitte zuerst ein Leistungsverzeichnis hochladen.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Pos.</th>
                    <th className="px-3 py-2 text-left">Kurztext</th>
                    <th className="px-2 py-2 text-right">Menge</th>
                    <th className="px-2 py-2 text-right">Einh.</th>
                    <th className="px-3 py-2 text-right">EP (€)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {positions.map((pos) => (
                    <tr key={pos.id}>
                      <td className="px-3 py-1.5 font-mono text-xs text-gray-400">{pos.positionNumber}</td>
                      <td className="px-3 py-1.5 text-gray-800">{pos.shortText}</td>
                      <td className="px-2 py-1.5 text-right text-gray-500">
                        {pos.quantity ? Number(pos.quantity).toLocaleString("de-DE") : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right text-gray-500">{pos.unit ?? "—"}</td>
                      <td className="px-3 py-1.5 text-right">
                        <input
                          inputMode="decimal"
                          value={prices[pos.id] ?? ""}
                          onChange={(e) => setPrices((p) => ({ ...p, [pos.id]: e.target.value }))}
                          placeholder="0,00"
                          className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-green-500 focus:outline-none"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Optionen */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">MwSt. (%)</label>
              <input
                inputMode="decimal"
                value={vatRate}
                onChange={(e) => setVatRate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Notiz (optional)</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="z. B. Angebot vom …"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
          <p className="text-sm text-gray-600">
            {filledCount} Position(en) bepreist · Netto{" "}
            <strong className="text-gray-900">
              {totalNet.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </strong>
          </p>
          <div className="flex items-center gap-2">
            <button onClick={close} className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={saving || positions.length === 0}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Angebot speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
