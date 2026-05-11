import { ProjectStatus } from "@prisma/client";
import { cn } from "@/lib/utils/cn";

const statusConfig: Record<ProjectStatus, { label: string; className: string }> = {
  DRAFT:          { label: "Entwurf",        className: "bg-gray-100 text-gray-600" },
  ACTIVE:         { label: "Aktiv",          className: "bg-blue-100 text-blue-700" },
  AWAITING_OFFERS:{ label: "Wartet",         className: "bg-yellow-100 text-yellow-700" },
  COMPARING:      { label: "Vergleich",      className: "bg-purple-100 text-purple-700" },
  AWARDED:        { label: "Vergeben",       className: "bg-green-100 text-green-700" },
  COMPLETED:      { label: "Abgeschlossen",  className: "bg-green-200 text-green-800" },
  ARCHIVED:       { label: "Archiv",         className: "bg-gray-200 text-gray-500" },
};

export default function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const config = statusConfig[status];
  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap", config.className)}>
      {config.label}
    </span>
  );
}
