"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Trash2, ImageIcon, Loader2 } from "lucide-react";

interface Props {
  logoUrl: string | null;
  canManage: boolean;
}

export default function TenantLogoUploader({ logoUrl, canManage }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/tenant/logo", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Upload fehlgeschlagen.");
        return;
      }
      router.refresh();
    } catch {
      setError("Upload fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/tenant/logo", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Entfernen fehlgeschlagen.");
        return;
      }
      router.refresh();
    } catch {
      setError("Entfernen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Firmenlogo" className="max-w-full max-h-full object-contain" />
          ) : (
            <ImageIcon className="w-7 h-7 text-gray-300" />
          )}
        </div>

        {canManage && (
          <div className="flex flex-col gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {logoUrl ? "Logo ändern" : "Logo hochladen"}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={busy}
                  className="inline-flex items-center gap-2 text-gray-500 hover:text-red-600 disabled:opacity-60 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-300 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Entfernen
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400">PNG, JPG, WEBP oder GIF, max. 2 MB.</p>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {!canManage && (
        <p className="text-xs text-gray-400">Nur Inhaber und Admins können das Logo ändern.</p>
      )}
    </div>
  );
}
