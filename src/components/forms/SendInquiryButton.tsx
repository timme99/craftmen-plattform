"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, X } from "lucide-react";

interface Supplier {
  id: string;
  companyName: string;
  email: string;
  trade?: string | null;
}

interface Props {
  projectId: string;
  suppliers: Supplier[];
}

export default function SendInquiryButton({ projectId, suppliers }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [deadline, setDeadline] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  function toggleSupplier(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function handleSend() {
    if (selected.length === 0) { setError("Bitte mindestens einen Lieferanten auswählen."); return; }
    setLoading(true); setError("");
    const res = await fetch("/api/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId, supplierIds: selected,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        customMessage: message || undefined,
      }),
    });
    setLoading(false);
    if (res.ok) {
      setSuccess(true);
      setTimeout(() => { setOpen(false); setSuccess(false); setSelected([]); router.refresh(); }, 1500);
    } else {
      setError("Fehler beim Senden. Bitte erneut versuchen.");
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
        <Send className="w-4 h-4" />
        Anfrage senden
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Anfrage an Lieferanten</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            {success ? (
              <div className="p-8 text-center">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Send className="w-7 h-7 text-green-600" />
                </div>
                <p className="font-semibold text-gray-900">Anfragen versendet!</p>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Lieferanten auswählen *</label>
                  {suppliers.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">Keine Lieferanten hinterlegt.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                      {suppliers.map((s) => (
                        <label key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                          <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggleSupplier(s.id)} className="accent-green-700 w-4 h-4" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{s.companyName}</p>
                            <p className="text-xs text-gray-500">{s.email}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  {selected.length > 0 && <p className="text-xs text-green-700 mt-1">{selected.length} ausgewählt</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Angebotsfrist (optional)</label>
                  <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Persönliche Nachricht (optional)</label>
                  <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)}
                    placeholder="Zusätzliche Hinweise für den Lieferanten…"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                <div className="flex justify-end gap-3 pt-1">
                  <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-gray-600">Abbrechen</button>
                  <button onClick={handleSend} disabled={loading || selected.length === 0}
                    className="flex items-center gap-2 bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                    <Send className="w-4 h-4" />
                    {loading ? "Wird gesendet…" : `${selected.length || ""} Anfragen senden`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
