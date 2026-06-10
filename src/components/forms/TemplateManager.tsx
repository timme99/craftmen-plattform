"use client";

import { useState } from "react";
import type { InquiryTemplate } from "@/types";

interface Props {
  initialTemplates: InquiryTemplate[];
}

export function TemplateManager({ initialTemplates }: Props) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [trade, setTrade] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/inquiry-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, trade: trade || undefined, subject, bodyHtml }),
    });
    setLoading(false);
    if (res.ok) {
      const json = await res.json();
      setTemplates((prev) => [json.data, ...prev]);
      setCreating(false);
      setName("");
      setTrade("");
      setSubject("");
      setBodyHtml("");
    } else {
      setError("Fehler beim Speichern.");
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/inquiry-templates/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => setCreating((c) => !c)}
        className="rounded-lg bg-[#2D6A4F] px-3 py-2 text-sm font-medium text-white hover:bg-[#245a42]"
      >
        {creating ? "Abbrechen" : "+ Neue Vorlage"}
      </button>

      {creating && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="z.B. Standard Gartenbau"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Gewerk (optional)
              </label>
              <input
                type="text"
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="z.B. Gartenbau"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Betreff</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Angebotsanfrage: {Projektname}"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">E-Mail-Text</label>
            <textarea
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              required
              rows={5}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono text-xs resize-y"
              placeholder="<p>Sehr geehrte Damen und Herren, ...</p>"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[#2D6A4F] px-4 py-2 text-sm font-medium text-white hover:bg-[#245a42] disabled:opacity-50"
          >
            {loading ? "Speichern…" : "Vorlage erstellen"}
          </button>
        </form>
      )}

      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-10 text-center">
          <p className="text-sm text-gray-400">Noch keine Vorlagen erstellt.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-start justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
            >
              <div>
                <p className="font-medium text-gray-900 text-sm">{t.name}</p>
                {t.trade && (
                  <span className="inline-block mt-0.5 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                    {t.trade}
                  </span>
                )}
                <p className="text-xs text-gray-400 mt-0.5">{t.subject}</p>
              </div>
              <button
                onClick={() => handleDelete(t.id)}
                className="text-xs text-red-400 hover:text-red-600 ml-4 shrink-0"
              >
                Löschen
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
