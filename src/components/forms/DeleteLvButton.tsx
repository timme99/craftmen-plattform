"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function DeleteLvButton({
  lvId,
  fileName,
}: {
  lvId: string;
  fileName: string;
}) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`„${fileName}" und alle zugehörigen Positionen wirklich löschen?`)) return;

    setDeleting(true);
    const res = await fetch(`/api/leistungsverzeichnisse/${lvId}`, { method: "DELETE" });
    setDeleting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      alert(body?.error ?? "Löschen fehlgeschlagen. Bitte erneut versuchen.");
      return;
    }
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      title="LV löschen"
      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
