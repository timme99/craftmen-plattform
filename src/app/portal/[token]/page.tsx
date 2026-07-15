import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma/client";
import SupplierPortalForm from "@/components/forms/SupplierPortalForm";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function SupplierPortalPage({ params }: Props) {
  const { token } = await params;

  const inquiry = await prisma.inquiry.findUnique({
    where: { portalToken: token },
    include: {
      supplier: true,
      project: {
        include: {
          leistungsverzeichnis: {
            include: { positions: { orderBy: { sortOrder: "asc" } } },
          },
        },
      },
      positions: {
        include: { position: true },
        orderBy: { position: { sortOrder: "asc" } },
      },
      offers: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!inquiry || inquiry.status === "EXPIRED" || inquiry.status === "DECLINED") {
    notFound();
  }

  // Mark portal as opened
  if (!inquiry.portalOpenedAt) {
    await prisma.inquiry.update({
      where: { id: inquiry.id },
      data: { portalOpenedAt: new Date(), status: "OPENED" },
    });
  }

  // Nur zugewiesene Positionen zeigen (konsistent zur Anfrage-E-Mail);
  // ohne Zuweisung wie bisher das komplette LV
  const assignedPositions = inquiry.positions.map((assignment) => assignment.position);
  const positions =
    assignedPositions.length > 0
      ? assignedPositions
      : inquiry.project.leistungsverzeichnis.flatMap((lv) => lv.positions);

  const existingOffer = inquiry.offers[0];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-green-800 text-white py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-green-300 text-xs font-medium uppercase tracking-wide">
              CraftMen Plattform
            </p>
            <h1 className="text-xl font-bold">Angebotsportal</h1>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {inquiry.project.name}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Angebot für: {inquiry.supplier.companyName}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Bitte geben Sie Ihre Preise für die unten stehenden Positionen ein.
          </p>
          {inquiry.deadline && (
            <p className="text-sm text-orange-600 mt-2 font-medium">
              Angebotsfrist:{" "}
              {new Date(inquiry.deadline).toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
        </div>

        <SupplierPortalForm
          inquiryId={inquiry.id}
          positions={positions}
          existingOffer={existingOffer ?? null}
        />
      </div>
    </div>
  );
}
