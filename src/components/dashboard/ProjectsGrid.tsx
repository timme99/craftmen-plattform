"use client";

import { useMemo, useState } from "react";
import type { ProjectStatus } from "@prisma/client";
import { Search } from "lucide-react";
import ProjectCard, { type ProjectCardData } from "./ProjectCard";

interface Props {
  projects: ProjectCardData[];
}

const statusFilters: Array<{ value: ProjectStatus | "ALL"; label: string }> = [
  { value: "ALL",             label: "Alle" },
  { value: "DRAFT",           label: "Entwurf" },
  { value: "ACTIVE",          label: "Aktiv" },
  { value: "AWAITING_OFFERS", label: "Wartet auf Angebote" },
  { value: "COMPARING",       label: "Vergleich" },
  { value: "AWARDED",         label: "Vergeben" },
  { value: "COMPLETED",       label: "Abgeschlossen" },
];

export default function ProjectsGrid({ projects }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "ALL">("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((project) => {
      if (status !== "ALL" && project.status !== status) return false;
      if (!q) return true;
      return (
        project.name.toLowerCase().includes(q) ||
        (project.location?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [projects, query, status]);

  const activeStatuses = new Set(projects.map((p) => p.status));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Projekt oder Ort suchen…"
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {statusFilters
            .filter((f) => f.value === "ALL" || activeStatuses.has(f.value))
            .map((f) => (
              <button
                key={f.value}
                onClick={() => setStatus(f.value)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  status === f.value
                    ? "bg-green-700 border-green-700 text-white"
                    : "bg-white border-gray-200 text-gray-600 hover:border-green-300 hover:text-green-800"
                }`}
              >
                {f.label}
              </button>
            ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white text-center py-16 px-6 text-gray-500">
          <p className="font-medium text-gray-700">Keine Projekte gefunden</p>
          <p className="text-sm mt-1">Passe Suche oder Statusfilter an.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
