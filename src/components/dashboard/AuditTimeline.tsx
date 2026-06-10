"use client";

import type { AuditLog } from "@/types";

const ACTION_LABELS: Record<string, string> = {
  PROJECT_CREATED: "Projekt erstellt",
  PROJECT_STATUS_CHANGED: "Status geändert",
  PROJECT_AWARDED: "Projekt vergeben",
  INQUIRY_SENT: "Anfrage versendet",
  INQUIRY_STATUS_CHANGED: "Anfrage-Status geändert",
  OFFER_SUBMITTED: "Angebot eingegangen (Portal)",
  OFFER_IMPORTED: "Angebot importiert (E-Mail)",
  OFFER_ITEM_MATCH_CONFIRMED: "Position manuell zugeordnet",
};

const ACTION_COLORS: Record<string, string> = {
  PROJECT_CREATED: "bg-blue-500",
  PROJECT_AWARDED: "bg-green-600",
  INQUIRY_SENT: "bg-indigo-500",
  OFFER_SUBMITTED: "bg-emerald-500",
  OFFER_IMPORTED: "bg-teal-500",
  OFFER_ITEM_MATCH_CONFIRMED: "bg-yellow-500",
};

interface Props {
  logs: AuditLog[];
}

export function AuditTimeline({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-400">Noch keine Aktivitäten aufgezeichnet.</p>
    );
  }

  return (
    <ol className="relative border-l border-gray-200">
      {logs.map((log) => {
        const meta = log.metadata as Record<string, unknown> | null;
        const label = ACTION_LABELS[log.action] ?? log.action;
        const dotColor = ACTION_COLORS[log.action] ?? "bg-gray-400";

        return (
          <li key={log.id} className="mb-6 ml-4">
            <div
              className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white ${dotColor}`}
            />
            <time className="mb-1 text-xs font-normal text-gray-400">
              {new Date(log.createdAt).toLocaleString("de-DE")}
            </time>
            <p className="text-sm font-medium text-gray-900">{label}</p>
            {meta && Object.keys(meta).length > 0 && (
              <p className="text-xs text-gray-500">
                {Object.entries(meta)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ")}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
