"use client";

import { useState } from "react";
import { X, Eye } from "lucide-react";

interface OfferItem {
  id: string;
  unitPrice: string | null;
  totalPrice: string | null;
  notes: string | null;
  position: { positionNumber: string; shortText: string; unit: string | null; quantity: string | null };
}

interface Offer {
  id: string;
  totalNet: string | null;
  totalGross: string | null;
  vatRate: string | null;
  notes: string | null;
  submittedAt: string | null;
  offerItems: OfferItem[];
}

interface Inquiry {
  id: string;
  offers: Offer[];
  supplier: { companyName: string };
}

interface Props {
  inquiryId: string;
  supplierName: string;
}

const fmt = (val: string | null) =>
  val != null ? Number(val).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";

export default function OfferDetailModal({ inquiryId, supplierName }: Props) {
  const [open, setOpen] = useState(false);
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    setOpen(true);
    setLoading(true);
    const res = await fetch(`/api/inquiries/${inquiryId}`);
    if (res.ok) setInquiry(await res.json());
    setLoading(false);
  }

  const offer = inquiry?.offers[0];

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 text-xs text-green-700 hover:text-green-800 font-medium px-2 py-1 rounded border border-green-200 hover:bg-green-50"
      >
        <Eye className="w-3.5 h-3.5" /> Angebot ansehen
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold">Angebot: {supplierName}</h2>
                {offer && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Eingereicht: {offer.submittedAt ? new Date(offer.submittedAt).toLocaleDateString("de-DE") : "—"}
                  </p>
                )}
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {loading && <p className="text-sm text-gray-400 text-center py-8">Lädt…</p>}
              {!loading && !offer && <p className="text-sm text-gray-400 text-center py-8">Kein Angebot vorhanden.</p>}
              {offer && (
                <div className="space-y-5">
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: "Netto", value: `${fmt(offer.totalNet)} €` },
                      { label: `MwSt. (${offer.vatRate ?? 19}%)`, value: offer.totalNet && offer.totalGross ? `${fmt(String(Number(offer.totalGross) - Number(offer.totalNet)))} €` : "—" },
                      { label: "Brutto", value: `${fmt(offer.totalGross)} €` },
                    ].map((item) => (
                      <div key={item.label} className="bg-gray-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500">{item.label}</p>
                        <p className="text-base font-semibold text-gray-900 mt-1">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                        <th className="text-left pb-2 pr-3 w-16">Pos.</th>
                        <th className="text-left pb-2 pr-3">Kurztext</th>
                        <th className="text-right pb-2 pr-3 w-20">Einheit</th>
                        <th className="text-right pb-2 pr-3 w-24">Menge</th>
                        <th className="text-right pb-2 pr-3 w-24">EP (€)</th>
                        <th className="text-right pb-2 w-28">GP (€)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {offer.offerItems.map((item) => (
                        <tr key={item.id}>
                          <td className="py-2 pr-3 text-gray-400 font-mono text-xs">{item.position.positionNumber}</td>
                          <td className="py-2 pr-3 text-gray-800">{item.position.shortText}</td>
                          <td className="py-2 pr-3 text-right text-gray-500">{item.position.unit ?? "—"}</td>
                          <td className="py-2 pr-3 text-right text-gray-600">{item.position.quantity ? Number(item.position.quantity).toLocaleString("de-DE") : "—"}</td>
                          <td className="py-2 pr-3 text-right font-medium">{fmt(item.unitPrice)}</td>
                          <td className="py-2 text-right font-semibold text-green-700">{fmt(item.totalPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {offer.notes && (
                    <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
                      <span className="font-medium">Hinweis: </span>{offer.notes}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
