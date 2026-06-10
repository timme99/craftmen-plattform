import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import { TemplateManager } from "@/components/forms/TemplateManager";

export default async function TemplatesPage() {
  const user = await requireTenant();

  const templates = await prisma.inquiryTemplate.findMany({
    where: { tenantId: user.tenantId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Anfrage-Vorlagen</h2>
        <p className="text-sm text-gray-500 mt-1">
          Definiere gewerk-spezifische E-Mail-Vorlagen für Angebotsanfragen.
        </p>
      </div>
      <TemplateManager initialTemplates={templates} />
    </div>
  );
}
