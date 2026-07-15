"use client";

import { useState } from "react";
import { Position, Offer } from "@prisma/client";

interface Props {
  inquiryId: string;
  positions: Position[];
  existingOffer: Offer | null;
}

export default function SupplierPortalForm({
  inquiryId,
  positions,
  existingOffer,
}: Props) {
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState(existingOffer?.notes ?? "");
  const [vatRate, setVatRate] = useState("19");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function handlePriceChange(positionId: string, value: string) {
    setPrices((prev) => ({ ...prev, [positionId]: value }));
  }

  const totalNet = positions.reduce((sum, pos) => {
    const unitPrice = parseFloat(prices[pos.id] || "0");
    const qty = pos.quantity ? Number(pos.quantity) : 0;
    return sum + unitPrice * qty;
  }, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const items = positions
      .filter((p) => prices[p.id] && parseFloat(prices[p.id]) > 0)
      .map((p) => ({
        positionId: p.id,
        unitPrice: parseFloat(prices[p.id]),
      }));

    if (items.length === 0) {
      setError("Bitte geben Sie mindestens einen Preis ein.");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inquiryId,
        portalToken: window.location.pathname.split("/").pop(),
        items,
        notes,
        vatRate: parseFloat(vatRate),
      }),
    });

    setSubmitting(false);

    if (res.ok) {
      setSubmitted(true);
    } else {
      setError("Fehler beim Speichern. Bitte versuchen Sie es erneut.");
    }
  }

  if (submitted) {
    return (
      <div className="bg-white rounded-xl border border-green-300 p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Vielen Dank!</h3>
        <p className="text-gray-500">
          Ihr Angebot wurde erfolgreich übermittelt. Wir melden uns bei Ihnen.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-700 w-16">Pos.</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Kurztext</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700 w-20">Einh.</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700 w-24">Menge</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700 w-36">EP (€)</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700 w-36">GP (€)</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos, idx) => {
                const unitPrice = parseFloat(prices[pos.id] || "0");
                const qty = pos.quantity ? Number(pos.quantity) : 0;
                const gp = unitPrice * qty;

                return (
                  <tr
                    key={pos.id}
                    className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      {pos.positionNumber}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{pos.shortText}</p>
                      {pos.longText && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                          {pos.longText}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{pos.unit ?? "—"}</td>
                    <td className="px-4 py-3 text-center text-gray-900">
                      {pos.quantity ? Number(pos.quantity).toLocaleString("de-DE") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={prices[pos.id] ?? ""}
                        onChange={(e) => handlePriceChange(pos.id, e.target.value)}
                        className="w-full text-right border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 font-medium">
                      {gp > 0 ? gp.toLocaleString("de-DE", { minimumFractionDigits: 2 }) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary & Submit */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Anmerkungen
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optionale Hinweise zu Ihrem Angebot…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Netto Gesamt:</span>
                <span className="font-semibold">
                  {totalNet.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <label className="text-gray-500">MwSt. (%):</label>
                <input
                  type="number"
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                  className="w-20 text-right border border-gray-300 rounded-md px-2 py-1 text-sm"
                />
              </div>
              <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-200">
                <span>Brutto Gesamt:</span>
                <span className="text-green-700">
                  {(totalNet * (1 + parseFloat(vatRate) / 100)).toLocaleString("de-DE", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  €
                </span>
              </div>
            </div>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          {submitting ? "Wird übermittelt…" : "Angebot verbindlich einreichen"}
        </button>
      </div>
    </form>
  );
}
