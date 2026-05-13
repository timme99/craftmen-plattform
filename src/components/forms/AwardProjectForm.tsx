"use client";

import { useState } from "react";

interface InquiryOption { id: string; supplier: string; totalNet: number; }

export default function AwardProjectForm({ projectId, options }: { projectId: string; options: InquiryOption[] }) {
  const [winner, setWinner] = useState(options[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [notifySuppliers, setNotifySuppliers] = useState(true);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setMsg("");
    const res = await fetch(`/api/projects/${projectId}/award`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winningInquiryId: winner, decisionNote: note, notifySuppliers }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Vergabe gespeichert. Benachrichtigt: ${data.notified ?? 0}` : data.error ?? "Fehler");
    setLoading(false);
  }

  if (!options.length) return null;

  return (
    <div className="bg-white rounded-xl border p-4 space-y-2">
      <h3 className="font-semibold">Vergabe</h3>
      <select className="border rounded px-2 py-1 text-sm w-full" value={winner} onChange={(e) => setWinner(e.target.value)}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.supplier} – {o.totalNet.toFixed(2)} €</option>)}
      </select>
      <input className="border rounded px-2 py-1 text-sm w-full" placeholder="Entscheidungsnotiz (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={notifySuppliers} onChange={(e) => setNotifySuppliers(e.target.checked)} />
        Lieferanten direkt benachrichtigen
      </label>
      <button disabled={loading} onClick={submit} className="px-3 py-2 rounded bg-green-700 disabled:opacity-60 text-white text-sm">{loading ? "Speichere…" : "Vergabe abschließen"}</button>
      {msg && <p className="text-xs text-gray-500">{msg}</p>}
    </div>
  );
}
