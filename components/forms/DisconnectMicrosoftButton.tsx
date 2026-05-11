"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Unlink } from "lucide-react";

export default function DisconnectMicrosoftButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDisconnect() {
    if (!confirm("Outlook-Verbindung wirklich trennen?")) return;
    setLoading(true);
    await fetch("/api/auth/microsoft/disconnect", { method: "POST" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleDisconnect}
      disabled={loading}
      className="flex items-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
    >
      <Unlink className="w-4 h-4" />
      {loading ? "Wird getrennt…" : "Verbindung trennen"}
    </button>
  );
}
