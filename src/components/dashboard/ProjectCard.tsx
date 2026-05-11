import Link from "next/link";
import { Project, ProjectStatus } from "@prisma/client";
import { MapPin, FileText, Send } from "lucide-react";
import ProjectStatusBadge from "./ProjectStatusBadge";

interface Props {
  project: Project & { _count: { inquiries: number; leistungsverzeichnis: number } };
}

export default function ProjectCard({ project }: Props) {
  return (
    <Link href={`/projects/${project.id}`} className="block group">
      <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-green-300 transition-all">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-gray-900 group-hover:text-green-800 transition-colors line-clamp-2">
            {project.name}
          </h3>
          <ProjectStatusBadge status={project.status} />
        </div>

        {project.location && (
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-3">
            <MapPin className="w-3.5 h-3.5" />
            <span className="truncate">{project.location}</span>
          </div>
        )}

        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            {project._count.leistungsverzeichnis} LV
          </span>
          <span className="flex items-center gap-1">
            <Send className="w-3.5 h-3.5" />
            {project._count.inquiries} Anfragen
          </span>
        </div>
      </div>
    </Link>
  );
}
