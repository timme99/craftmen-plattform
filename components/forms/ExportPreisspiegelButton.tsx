"use client";

import { useState } from "react";
import { Download } from "lucide-react";

export default function ExportPreisspiegelButton({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/export?projectId=${projectId}`);
      if (!res.ok) throw new Error("Export fehlgeschlagen");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Preisspiegel-${projectId.slice(0, 8)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Export fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-2 border border-green-700 text-green-700 hover:bg-green-50 disabled:opacity-50 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
    >
      <Download className="w-3.5 h-3.5" />
      {loading ? "Wird erstellt…" : "Preisspiegel Excel"}
    </button>
  );
}
