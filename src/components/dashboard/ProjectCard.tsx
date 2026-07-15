import Link from "next/link";
import type { ProjectStatus } from "@prisma/client";
import { MapPin, FileText, Send, ArrowRight } from "lucide-react";
import ProjectStatusBadge from "./ProjectStatusBadge";

export interface ProjectCardData {
  id: string;
  name: string;
  location: string | null;
  status: ProjectStatus;
  lvCount: number;
  inquiryCount: number;
}

interface Props {
  project: ProjectCardData;
}

export default function ProjectCard({ project }: Props) {
  return (
    <Link href={`/projects/${project.id}`} className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 rounded-2xl">
      <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-lg hover:border-green-300 transition-all duration-200 h-full">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-semibold text-gray-900 group-hover:text-green-800 transition-colors line-clamp-2 text-base">
            {project.name}
          </h3>
          <ProjectStatusBadge status={project.status} />
        </div>

        {project.location && (
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-4">
            <MapPin className="w-3.5 h-3.5" />
            <span className="truncate">{project.location}</span>
          </div>
        )}

        <div className="flex items-center gap-4 pt-4 border-t border-gray-100 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            {project.lvCount} LV
          </span>
          <span className="flex items-center gap-1">
            <Send className="w-3.5 h-3.5" />
            {project.inquiryCount} Anfragen
          </span>
          <span className="ml-auto inline-flex items-center gap-1 text-green-700 font-medium group-hover:translate-x-0.5 transition-transform">
            Öffnen
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
