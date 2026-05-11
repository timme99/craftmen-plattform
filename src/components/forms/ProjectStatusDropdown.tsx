"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectStatus } from "@prisma/client";

const statusOptions: { value: ProjectStatus; label: string }[] = [
  { value: "DRAFT",           label: "Entwurf" },
  { value: "ACTIVE",          label: "Aktiv" },
  { value: "AWAITING_OFFERS", label: "Wartet auf Angebote" },
  { value: "COMPARING",       label: "Vergleich" },
  { value: "AWARDED",         label: "Vergeben" },
  { value: "COMPLETED",       label: "Abgeschlossen" },
  { value: "ARCHIVED",        label: "Archiviert" },
];

interface Props {
  projectId: string;
  currentStatus: ProjectStatus;
}

export default function ProjectStatusDropdown({ projectId, currentStatus }: Props) {
  const [status, setStatus] = useState<ProjectStatus>(currentStatus);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as ProjectStatus;
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setStatus(newStatus);
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <select
      value={status}
      onChange={handleChange}
      disabled={loading}
      className="text-xs font-medium border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 cursor-pointer"
    >
      {statusOptions.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
