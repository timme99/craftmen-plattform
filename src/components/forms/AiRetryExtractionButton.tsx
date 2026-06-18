"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

interface Props {
  lvId: string;
}

// Backup: extrahiert die LV-Positionen per Claude direkt aus dem PDF (bei FAILED).
export default function AiRetryExtractionButton({ lvId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    setError("");

    const res = await fetch(`/api/pdf-extract/${lvId}/ai-retry`, { method: "POST" });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === "string" ? body.error : "Auslesen fehlgeschlagen.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="inline-flex flex-col items-end">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-xs text-green-700 hover:text-green-900 font-medium px-2 py-1 rounded border border-green-200 hover:bg-green-50 disabled:opacity-60"
      >
        <Sparkles className="w-3.5 h-3.5" />
        {loading ? "Liest aus…" : "Mit Claude auslesen"}
      </button>
      {error && <span className="text-[11px] text-red-600 mt-1">{error}</span>}
    </div>
  );
}
