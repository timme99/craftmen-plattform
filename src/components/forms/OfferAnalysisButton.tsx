"use client";

import { useState } from "react";
import { Sparkles, X, AlertTriangle } from "lucide-react";

interface Ranking {
  supplierId: string;
  companyName: string;
  rank: number;
  totalNet: number | null;
  rationale: string;
}
interface Risk {
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
}
interface Analysis {
  ranking: Ranking[];
  risks: Risk[];
  recommendation: string;
  nextSteps: string[];
}

interface Props {
  projectId: string;
}

const severityColor: Record<Risk["severity"], string> = {
  HIGH: "text-red-700 bg-red-50",
  MEDIUM: "text-amber-700 bg-amber-50",
  LOW: "text-gray-600 bg-gray-50",
};

export default function OfferAnalysisButton({ projectId }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  async function runAnalysis() {
    setOpen(true);
    setLoading(true);
    setError("");
    setAnalysis(null);

    const res = await fetch(`/api/projects/${projectId}/offer-analysis`, { method: "POST" });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === "string" ? body.error : "Analyse fehlgeschlagen.");
      return;
    }
    const body = (await res.json()) as { data: Analysis };
    setAnalysis(body.data);
  }

  return (
    <>
      <button
        onClick={runAnalysis}
        className="flex items-center gap-2 border border-green-200 text-green-700 hover:bg-green-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        <Sparkles className="w-4 h-4" />
        Angebote analysieren
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-green-600" />
                KI-Angebotsanalyse
              </h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {loading && <p className="text-sm text-gray-500">Claude analysiert die Angebote…</p>}
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

              {analysis && (
                <>
                  <section>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Ranking</h3>
                    <div className="space-y-2">
                      {analysis.ranking
                        .slice()
                        .sort((a, b) => a.rank - b.rank)
                        .map((r) => (
                          <div key={r.supplierId} className="border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-gray-900">
                                #{r.rank} · {r.companyName}
                              </p>
                              <p className="text-sm text-gray-600">
                                {r.totalNet != null
                                  ? `${r.totalNet.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
                                  : "—"}
                              </p>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{r.rationale}</p>
                          </div>
                        ))}
                    </div>
                  </section>

                  {analysis.risks.length > 0 && (
                    <section>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">Risiken</h3>
                      <div className="space-y-2">
                        {analysis.risks.map((risk, i) => (
                          <div key={i} className={`flex gap-2 rounded-lg px-3 py-2 text-sm ${severityColor[risk.severity]}`}>
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>
                              <strong>{risk.severity}:</strong> {risk.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  <section>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Empfehlung</h3>
                    <p className="text-sm text-gray-700 bg-green-50 rounded-lg px-3 py-2">{analysis.recommendation}</p>
                  </section>

                  {analysis.nextSteps.length > 0 && (
                    <section>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">Nächste Schritte</h3>
                      <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                        {analysis.nextSteps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                  <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
                    KI-generierter Vorschlag – bitte vor der Vergabe prüfen.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
