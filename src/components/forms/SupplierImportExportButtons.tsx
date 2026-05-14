"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, CheckCircle, AlertCircle, X } from "lucide-react";

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export default function SupplierImportExportButtons() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleExport() {
    const res = await fetch("/api/suppliers/export");
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = disposition.match(/filename="([^"]+)"/);
    a.download = match?.[1] ?? "lieferanten.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/suppliers/import", { method: "POST", body: formData });
    const json = await res.json();

    setImporting(false);
    e.target.value = "";

    if (!res.ok) {
      setError(json.error ?? "Import fehlgeschlagen");
    } else {
      setResult(json.data);
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Toast-style result */}
      {(result || error) && (
        <div
          className={`flex items-start gap-2 text-sm px-3 py-2 rounded-lg border ${
            error
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-green-50 border-green-200 text-green-800"
          }`}
        >
          {error ? (
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <span>
            {error
              ? error
              : `${result!.created} neu, ${result!.updated} aktualisiert${
                  result!.skipped > 0 ? `, ${result!.skipped} übersprungen` : ""
                }${result!.errors.length > 0 ? ` (${result!.errors.length} Fehler)` : ""}`}
          </span>
          <button
            onClick={() => { setResult(null); setError(null); }}
            className="ml-1 opacity-60 hover:opacity-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={importing}
        className="flex items-center gap-2 border border-gray-300 hover:border-gray-400 bg-white text-gray-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-60"
        title="Lieferanten aus Excel importieren"
      >
        <Upload className="w-4 h-4" />
        {importing ? "Importiere…" : "Importieren"}
      </button>

      <button
        onClick={handleExport}
        className="flex items-center gap-2 border border-gray-300 hover:border-gray-400 bg-white text-gray-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
        title="Lieferanten als Excel exportieren"
      >
        <Download className="w-4 h-4" />
        Exportieren
      </button>
    </div>
  );
}
