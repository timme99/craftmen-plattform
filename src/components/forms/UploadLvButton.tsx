"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

export default function UploadLvButton({ projectId }: { projectId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Zurücksetzen, damit dieselbe Datei erneut gewählt werden kann
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    form.append("projectId", projectId);

    try {
      const res = await fetch("/api/pdf-extract", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          typeof body.error === "string"
            ? body.error
            : "Upload fehlgeschlagen. Bitte erneut versuchen."
        );
        return;
      }
      router.refresh();
    } catch {
      setError("Netzwerkfehler beim Upload. Bitte erneut versuchen.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 border border-green-700 text-green-700 hover:bg-green-50 disabled:opacity-50 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
      >
        <Upload className="w-3.5 h-3.5" />
        {uploading ? "Wird hochgeladen…" : "LV hochladen"}
      </button>
      {error && <p className="text-xs text-red-600 max-w-64 text-right">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
