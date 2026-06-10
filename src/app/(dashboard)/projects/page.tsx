import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import ProjectCard from "@/components/dashboard/ProjectCard";
import CreateProjectButton from "@/components/forms/CreateProjectButton";
import EmailScannerButton from "@/components/forms/EmailScannerButton";
import { DashboardBriefing } from "@/components/dashboard/DashboardBriefing";

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

  const totalInquiries = projects.reduce((sum, project) => sum + project._count.inquiries, 0);
  const totalLv = projects.reduce((sum, project) => sum + project._count.leistungsverzeichnis, 0);

  return (
    <div className="space-y-6">
      <DashboardBriefing />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Projekte</h1>
          <p className="text-sm text-gray-500 mt-1">
            Übersicht über alle aktiven Ausschreibungen und Anfragen.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {emailConn?.isActive && <EmailScannerButton />}
          <CreateProjectButton />
        </div>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Projekte</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{projects.length}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Anfragen gesamt</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{totalInquiries}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">LV-Positionen</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{totalLv}</p>
        </div>
      </section>

      {!emailConn && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-900 flex items-start gap-2.5">
          <span aria-hidden>⚠️</span>
          <span>
            Noch kein Outlook-Konto verbunden. <a href="/settings" className="font-semibold underline">Jetzt verbinden</a>, um E-Mails automatisch zu senden und zu empfangen.
          </span>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white text-center py-20 px-6 text-gray-500">
          <p className="text-lg font-semibold text-gray-800">Noch keine Projekte</p>
          <p className="text-sm mt-1">Lege dein erstes Projekt an, um Ausschreibungen zentral zu steuern.</p>
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
