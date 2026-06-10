"use client";

import { useState } from "react";
import type { Inquiry, Supplier } from "@/types";

type InquiryWithSupplier = Inquiry & { supplier: Supplier };

interface Props {
  projectId: string;
  inquiries: InquiryWithSupplier[];
}

export function InvoiceUploadForm({ projectId, inquiries }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedInquiryId, setSelectedInquiryId] = useState(inquiries[0]?.id ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issuedAt, setIssuedAt] = useState(new Date().toISOString().split("T")[0]);
  const [totalNet, setTotalNet] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (inquiries.length === 0) {
    return (
      <span className="text-xs text-gray-400">
        Erst ein Angebot eingeholt, bevor Rechnungen erfasst werden können.
      </span>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const net = parseFloat(totalNet);
    if (isNaN(net) || net <= 0) {
      setError("Bitte einen gültigen Nettobetrag eingeben.");
      setLoading(false);
      return;
    }

    const res = await fetch(`/api/projects/${projectId}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inquiryId: selectedInquiryId,
        invoiceNumber,
        issuedAt: new Date(issuedAt).toISOString(),
        notes: notes || undefined,
        items: [{ unitPrice: net, totalPrice: net }],
      }),
    });

    setLoading(false);
    if (res.ok) {
      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        window.location.reload();
      }, 800);
    } else {
      const json = await res.json();
      setError(json.error ?? "Fehler beim Speichern.");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-[#2D6A4F] px-3 py-2 text-sm font-medium text-white hover:bg-[#245a42]"
      >
        + Rechnung erfassen
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4"
      >
        <h3 className="text-base font-semibold text-gray-900">Rechnung erfassen</h3>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Lieferant / Anfrage</label>
          <select
            value={selectedInquiryId}
            onChange={(e) => setSelectedInquiryId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          >
            {inquiries.map((inq) => (
              <option key={inq.id} value={inq.id}>
                {inq.supplier.companyName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Rechnungsnummer</label>
          <input
            type="text"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="z.B. RE-2026-001"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Rechnungsdatum</label>
          <input
            type="date"
            value={issuedAt}
            onChange={(e) => setIssuedAt(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Nettobetrag (€)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={totalNet}
            onChange={(e) => setTotalNet(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Notizen (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none"
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
        {success && <p className="text-xs text-green-600">Rechnung gespeichert!</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-lg bg-[#2D6A4F] px-4 py-2 text-sm font-medium text-white hover:bg-[#245a42] disabled:opacity-50"
          >
            {loading ? "Speichern…" : "Rechnung speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}
