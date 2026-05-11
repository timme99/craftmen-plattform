import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import ProjectCard from "@/components/dashboard/ProjectCard";
import CreateProjectButton from "@/components/forms/CreateProjectButton";

export default async function ProjectsPage() {
  const user = await requireTenant();

  const projects = await prisma.project.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { inquiries: true, leistungsverzeichnis: true } },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projekte</h1>
          <p className="text-sm text-gray-500 mt-1">
            {projects.length} {projects.length === 1 ? "Projekt" : "Projekte"}
          </p>
        </div>
        <CreateProjectButton />
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg font-medium">Noch keine Projekte</p>
          <p className="text-sm mt-1">Lege dein erstes Projekt an, um zu starten.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
