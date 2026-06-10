"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CopilotItem } from "@/types";

const PRIORITY_STYLES = {
  HIGH: "border-red-200 bg-red-50",
  MEDIUM: "border-yellow-200 bg-yellow-50",
  LOW: "border-gray-200 bg-gray-50",
};

const PRIORITY_DOT = {
  HIGH: "bg-red-500",
  MEDIUM: "bg-yellow-500",
  LOW: "bg-gray-400",
};

export function DashboardBriefing() {
  const [items, setItems] = useState<CopilotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/briefing")
      .then((r) => r.json())
      .then((json) => setItems(json.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (items.length === 0) return null;

  const highCount = items.filter((i) => i.priority === "HIGH").length;

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">Tagesbriefing</span>
          {highCount > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-medium text-white">
              {highCount} dringend
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">{collapsed ? "Einblenden ▼" : "Ausblenden ▲"}</span>
      </button>

      {!collapsed && (
        <div className="divide-y divide-gray-100 border-t border-gray-100">
          {items.map((item) => (
            <div
              key={item.entityId + item.type}
              className={`flex items-start gap-3 px-4 py-3 ${PRIORITY_STYLES[item.priority]}`}
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[item.priority]}`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{item.title}</p>
                <p className="text-xs text-gray-500 truncate">{item.description}</p>
              </div>
              <Link
                href={item.actionUrl}
                className="shrink-0 rounded bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm border border-gray-200 hover:bg-gray-50"
              >
                Ansehen →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
