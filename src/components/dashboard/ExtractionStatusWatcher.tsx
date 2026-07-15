"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface Props {
  projectId: string;
  /** IDs der LVs, die aktuell PENDING oder PROCESSING sind */
  pendingLvIds: string[];
}

const POLL_INTERVAL_MS = 5_000;

/**
 * Pollt den Extraktionsstatus, solange LVs in Verarbeitung sind, und lädt die
 * Server-Daten neu, sobald sich ein Status ändert. Nach dem Refresh liefert die
 * Seite eine aktualisierte pendingLvIds-Liste, wodurch das Polling automatisch
 * endet, wenn nichts mehr in Verarbeitung ist.
 */
export default function ExtractionStatusWatcher({ projectId, pendingLvIds }: Props) {
  const router = useRouter();
  const pendingKey = pendingLvIds.join(",");

  useEffect(() => {
    if (!pendingKey) return;
    const pending = new Set(pendingKey.split(","));

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/leistungsverzeichnisse?projectId=${projectId}`);
        if (!res.ok) return;
        const body = (await res.json()) as {
          data: Array<{ id: string; extractionStatus: string }>;
        };
        const changed = body.data.some(
          (lv) =>
            pending.has(lv.id) &&
            lv.extractionStatus !== "PENDING" &&
            lv.extractionStatus !== "PROCESSING"
        );
        if (changed) router.refresh();
      } catch {
        // Netzwerkfehler ignorieren, nächster Tick versucht es erneut
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [projectId, pendingKey, router]);

  if (!pendingKey) return null;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      <span>
        {pendingLvIds.length === 1
          ? "Ein LV wird gerade verarbeitet — die Seite aktualisiert sich automatisch."
          : `${pendingLvIds.length} LVs werden gerade verarbeitet — die Seite aktualisiert sich automatisch.`}
      </span>
    </div>
  );
}
