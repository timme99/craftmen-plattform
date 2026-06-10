import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import { InvoiceUploadForm } from "@/components/forms/InvoiceUploadForm";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function RechnungenPage({ params }: Props) {
  const { projectId } = await params;
  const user = await requireTenant();

  const [invoices, inquiries] = await Promise.all([
    prisma.invoice.findMany({
      where: { projectId, tenantId: user.tenantId },
      include: {
        invoiceItems: { include: { position: true } },
        inquiry: { include: { supplier: true } },
      },
      orderBy: { issuedAt: "desc" },
    }),
    prisma.inquiry.findMany({
      where: { projectId, tenantId: user.tenantId, status: "OFFER_RECEIVED" },
      include: { supplier: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Rechnungen</h2>
        <InvoiceUploadForm projectId={projectId} inquiries={inquiries} />
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center">
          <p className="text-sm text-gray-400">Noch keine Rechnungen erfasst.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {invoices.map((invoice) => (
            <div key={invoice.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    Rechnung {invoice.invoiceNumber}
                  </p>
                  <p className="text-sm text-gray-500">
                    {invoice.inquiry.supplier.companyName} ·{" "}
                    {new Date(invoice.issuedAt).toLocaleDateString("de-DE")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    {Number(invoice.totalNet).toLocaleString("de-DE", {
                      style: "currency",
                      currency: "EUR",
                    })}{" "}
                    netto
                  </p>
                  <p className="text-xs text-gray-400">
                    inkl. {Number(invoice.vatRate)}% MwSt.:{" "}
                    {Number(invoice.totalGross).toLocaleString("de-DE", {
                      style: "currency",
                      currency: "EUR",
                    })}
                  </p>
                </div>
              </div>
              {invoice.invoiceItems.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-xs text-gray-600">
                    <thead>
                      <tr className="border-b border-gray-100 text-left">
                        <th className="pb-1 pr-4">Position</th>
                        <th className="pb-1 pr-4 text-right">EP</th>
                        <th className="pb-1 text-right">GP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.invoiceItems.map((item) => (
                        <tr key={item.id} className="border-b border-gray-50">
                          <td className="py-0.5 pr-4">
                            {item.position
                              ? `${item.position.positionNumber} ${item.position.shortText}`
                              : "–"}
                          </td>
                          <td className="py-0.5 pr-4 text-right">
                            {Number(item.unitPrice).toLocaleString("de-DE", {
                              style: "currency",
                              currency: "EUR",
                            })}
                          </td>
                          <td className="py-0.5 text-right">
                            {Number(item.totalPrice).toLocaleString("de-DE", {
                              style: "currency",
                              currency: "EUR",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {invoice.notes && (
                <p className="mt-2 text-xs text-gray-400">{invoice.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
