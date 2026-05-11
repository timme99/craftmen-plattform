import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import CreateSupplierButton from "@/components/forms/CreateSupplierButton";
import { Mail, Phone, Building2 } from "lucide-react";

export default async function SuppliersPage() {
  const user = await requireTenant();

  const suppliers = await prisma.supplier.findMany({
    where: { tenantId: user.tenantId, isActive: true },
    orderBy: { companyName: "asc" },
    include: { _count: { select: { inquiries: true } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lieferanten</h1>
          <p className="text-sm text-gray-500 mt-1">
            {suppliers.length} {suppliers.length === 1 ? "Lieferant" : "Lieferanten"}
          </p>
        </div>
        <CreateSupplierButton />
      </div>

      {suppliers.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Noch keine Lieferanten</p>
          <p className="text-sm mt-1">Lege deinen ersten Lieferanten an.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {suppliers.map((s) => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{s.companyName}</h3>
                  {s.contactName && <p className="text-sm text-gray-500">{s.contactName}</p>}
                </div>
                {s.trade && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{s.trade}</span>
                )}
              </div>
              <div className="space-y-1.5 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  <span className="truncate">{s.email}</span>
                </div>
                {s.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    <span>{s.phone}</span>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400">
                {s._count.inquiries} Anfragen gesendet
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
