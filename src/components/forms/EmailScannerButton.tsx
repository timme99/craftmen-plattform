"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

export default function EmailScannerButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ message: string; processed: number } | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleScan() {
    setLoading(true); setError(""); setResult(null);
    const res = await fetch("/api/email-scanner", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setResult(data);
      if (data.processed > 0) router.refresh();
    } else {
      setError(data.error ?? "Fehler beim Scannen");
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button onClick={handleScan} disabled={loading}
        className="flex items-center gap-2 border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors">
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Postfach wird gescannt…" : "Postfach scannen"}
      </button>
      {result && (
        <span className="flex items-center gap-1.5 text-sm text-green-700">
          <CheckCircle className="w-4 h-4" />{result.message}
        </span>
      )}
      {error && (
        <span className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" />{error}
        </span>
      )}
    </div>
  );
}
