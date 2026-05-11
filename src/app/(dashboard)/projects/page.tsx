import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import ProjectCard from "@/components/dashboard/ProjectCard";
import CreateProjectButton from "@/components/forms/CreateProjectButton";
import EmailScannerButton from "@/components/forms/EmailScannerButton";

export default async function ProjectsPage() {
  const user = await requireTenant();

  const [projects, emailConn] = await Promise.all([
    prisma.project.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { inquiries: true, leistungsverzeichnis: true } },
      },
    }),
    prisma.emailConnection.findUnique({
      where: { tenantId: user.tenantId },
      select: { emailAddress: true, isActive: true },
    }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projekte</h1>
          <p className="text-sm text-gray-500 mt-1">
            {projects.length} {projects.length === 1 ? "Projekt" : "Projekte"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {emailConn?.isActive && <EmailScannerButton />}
          <CreateProjectButton />
        </div>
      </div>

      {/* Email connection hint */}
      {!emailConn && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-800 flex items-center gap-2">
          <span>⚠️</span>
          <span>
            Noch kein Outlook-Konto verbunden.{" "}
            <a href="/settings" className="font-medium underline">
              Jetzt unter Einstellungen verbinden
            </a>{" "}
            um E-Mails automatisch zu senden und zu empfangen.
          </span>
        </div>
      )}

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
