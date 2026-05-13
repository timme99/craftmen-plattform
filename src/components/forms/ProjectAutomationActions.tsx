"use client";

import { useState } from "react";

export default function ProjectAutomationActions() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  async function sendReminders(dryRun: boolean) {
    setLoading(true);
    setMsg("");
    const res = await fetch("/api/inquiries/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun }),
    });
    const data = await res.json();
    setMsg(
      res.ok
        ? dryRun
          ? `${data.candidates ?? 0} fällige Anfragen gefunden (Vorschau).`
          : `${data.reminded ?? 0} Erinnerungen versendet.`
        : data.error ?? "Fehler"
    );
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => sendReminders(true)} disabled={loading} className="px-3 py-2 rounded-lg border text-sm">
        Vorschau
      </button>
      <button onClick={() => sendReminders(false)} disabled={loading} className="px-3 py-2 rounded-lg border text-sm">
        {loading ? "Sende…" : "Erinnerungen senden"}
      </button>
      {msg && <p className="text-xs text-gray-500">{msg}</p>}
    </div>
  );
}
