"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, X, Sparkles, AlertTriangle, CheckCircle } from "lucide-react";

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

type EmailSummary = {
  connected: boolean;
  sent: number;
  failed: number;
  skipped: number;
  results: { supplierId: string; supplierName: string; status: "sent" | "failed" | "skipped"; error?: string }[];
};

export default function SendInquiryButton({ projectId, suppliers }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [deadline, setDeadline] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<EmailSummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const router = useRouter();

  function closeAndReset() {
    setOpen(false);
    setResult(null);
    setSelected([]);
    setError("");
    router.refresh();
  }

  async function draftEmail() {
    if (selected.length === 0) {
      setError("Bitte zuerst einen Lieferanten auswählen.");
      return;
    }
    setAiLoading(true);
    setError("");

    const res = await fetch("/api/ai/inquiry-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, supplierId: selected[0] }),
    });

    setAiLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === "string" ? body.error : "KI-Entwurf fehlgeschlagen. Bitte erneut versuchen.");
      return;
    }
    const body = (await res.json()) as { data: { subject: string; body: string } };
    setMessage(body.data.body);
  }

  function toggleSupplier(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function handleSend() {
    if (selected.length === 0) {
      setError("Bitte mindestens einen Lieferanten auswählen.");
      return;
    }
    setLoading(true);
    setError("");

    const res = await fetch("/api/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        supplierIds: selected,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        customMessage: message || undefined,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      setError("Fehler beim Senden. Bitte erneut versuchen.");
      return;
    }

    const body = (await res.json().catch(() => null)) as { email?: EmailSummary } | null;
    const email: EmailSummary =
      body?.email ??
      // Fallback, falls die API (alt) kein Ergebnis mitschickt
      { connected: true, sent: selected.length, failed: 0, skipped: 0, results: [] };

    setResult(email);

    // Nur bei rundum erfolgreichem Versand automatisch schließen; sonst offen
    // lassen, damit der Nutzer den Hinweis (Entwurf / Fehler) sieht.
    if (email.failed === 0 && email.skipped === 0 && email.sent > 0) {
      setTimeout(closeAndReset, 1500);
    } else {
      router.refresh();
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        <Send className="w-4 h-4" />
        Anfrage senden
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Anfrage an Lieferanten</h2>
              <button onClick={closeAndReset} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {result ? (
              result.sent > 0 && result.failed === 0 && result.skipped === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Send className="w-7 h-7 text-green-600" />
                  </div>
                  <p className="font-semibold text-gray-900">
                    {result.sent === 1 ? "Anfrage versendet!" : `${result.sent} Anfragen versendet!`}
                  </p>
                </div>
              ) : (
                <div className="p-5 space-y-3">
                  {!result.connected && (
                    <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        Kein E-Mail-Konto verbunden – die Anfragen wurden als <strong>Entwurf</strong> gespeichert und
                        noch <strong>nicht versendet</strong>. Verbinde dein Konto in den{" "}
                        <a href="/settings" className="underline font-medium">Einstellungen</a>.
                      </span>
                    </div>
                  )}

                  {result.sent > 0 && (
                    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      <span>{result.sent === 1 ? "1 Anfrage versendet" : `${result.sent} Anfragen versendet`}</span>
                    </div>
                  )}

                  {result.failed > 0 && (
                    <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 space-y-1">
                      <p className="font-medium">
                        {result.failed === 1 ? "1 Anfrage fehlgeschlagen:" : `${result.failed} Anfragen fehlgeschlagen:`}
                      </p>
                      <ul className="list-disc pl-5 space-y-0.5">
                        {result.results
                          .filter((r) => r.status === "failed")
                          .map((r) => (
                            <li key={r.supplierId}>
                              <span className="font-medium">{r.supplierName}</span>
                              {r.error ? <span className="text-red-600"> – {r.error}</span> : null}
                            </li>
                          ))}
                      </ul>
                      <p className="text-xs text-red-600 pt-1">
                        Diese wurden als Entwurf gespeichert und können erneut gesendet werden.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={closeAndReset}
                      className="px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 rounded-lg"
                    >
                      Schließen
                    </button>
                  </div>
                </div>
              )
            ) : (
              <div className="p-5 space-y-4">
                {/* Supplier selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lieferanten auswählen *
                  </label>
                  {suppliers.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">
                      Keine Lieferanten hinterlegt. Zuerst Lieferanten anlegen.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                      {suppliers.map((s) => (
                        <label
                          key={s.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selected.includes(s.id)}
                            onChange={() => toggleSupplier(s.id)}
                            className="accent-green-700 w-4 h-4"
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{s.companyName}</p>
                            <p className="text-xs text-gray-500">{s.email}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  {selected.length > 0 && (
                    <p className="text-xs text-green-700 mt-1">{selected.length} ausgewählt</p>
                  )}
                </div>

                {/* Deadline */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Angebotsfrist (optional)
                  </label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                {/* Custom message */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Persönliche Nachricht (optional)
                    </label>
                    <button
                      type="button"
                      onClick={draftEmail}
                      disabled={aiLoading || selected.length === 0}
                      className="inline-flex items-center gap-1.5 text-xs text-green-700 hover:text-green-900 font-medium disabled:opacity-50"
                      title="Nutzt den ersten ausgewählten Lieferanten"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {aiLoading ? "Entwurf läuft…" : "E-Mail vorformulieren"}
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Zusätzliche Hinweise für den Lieferanten…"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                {error && (
                  <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
                )}

                <div className="flex justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={loading || selected.length === 0}
                    className="flex items-center gap-2 bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
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
