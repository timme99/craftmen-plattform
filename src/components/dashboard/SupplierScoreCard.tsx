"use client";

import { useState } from "react";
import type { SupplierScore } from "@/types";

interface Props {
  supplierId: string;
  score: SupplierScore | null;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span className="font-medium">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-200">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function SupplierScoreCard({ supplierId, score: initialScore }: Props) {
  const [score, setScore] = useState<SupplierScore | null>(initialScore);
  const [loading, setLoading] = useState(false);

  async function recalculate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/calculate-score`, { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        setScore(json.data);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-gray-700">Lieferanten-Score</span>
        <button
          onClick={recalculate}
          disabled={loading}
          className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-200 disabled:opacity-50"
        >
          {loading ? "…" : "Neu berechnen"}
        </button>
      </div>
      {score ? (
        <div className="space-y-2">
          <ScoreBar label="Antwortquote" value={Number(score.responseRate)} />
          <ScoreBar label="Fristeinhaltung" value={Number(score.deadlineRate)} />
          <ScoreBar label="Match-Qualität" value={Number(score.avgMatchQuality)} />
          <ScoreBar label="Preisstabilität" value={Number(score.priceStability)} />
          <p className="mt-1 text-xs text-gray-400">
            Aus {score.totalInquiries} Anfragen · {score.totalOffers} Angeboten
          </p>
        </div>
      ) : (
        <p className="text-xs text-gray-400">Noch kein Score berechnet.</p>
      )}
    </div>
  );
}
