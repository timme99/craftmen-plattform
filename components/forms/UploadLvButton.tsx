"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

export default function UploadLvButton({ projectId }: { projectId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("projectId", projectId);

    await fetch("/api/pdf-extract", { method: "POST", body: form });
    setUploading(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 border border-green-700 text-green-700 hover:bg-green-50 disabled:opacity-50 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
      >
        <Upload className="w-3.5 h-3.5" />
        {uploading ? "Wird hochgeladen…" : "LV hochladen"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFile}
      />
    </>
  );
}
