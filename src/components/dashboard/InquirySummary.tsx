"use client";

import { Inquiry, Supplier, Offer, InquiryStatus } from "@prisma/client";
import { cn } from "@/lib/utils/cn";
import { CheckCircle, Clock, Send, X } from "lucide-react";

type InquiryWithDetails = Inquiry & { supplier: Supplier; offers: Offer[] };

interface Props {
  inquiries: InquiryWithDetails[];
}

const statusIcons: Record<InquiryStatus, React.ReactNode> = {
  DRAFT:          <Clock className="w-4 h-4 text-gray-400" />,
  SENT:           <Send className="w-4 h-4 text-blue-500" />,
  OPENED:         <Send className="w-4 h-4 text-purple-500" />,
  OFFER_RECEIVED: <CheckCircle className="w-4 h-4 text-green-600" />,
  DECLINED:       <X className="w-4 h-4 text-red-500" />,
  EXPIRED:        <X className="w-4 h-4 text-orange-500" />,
};

const statusLabels: Record<InquiryStatus, string> = {
  DRAFT:          "Entwurf",
  SENT:           "Gesendet",
  OPENED:         "Geöffnet",
  OFFER_RECEIVED: "Angebot erhalten",
  DECLINED:       "Abgelehnt",
  EXPIRED:        "Abgelaufen",
};

export default function InquirySummary({ inquiries }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-lg font-semibold mb-4">Lieferantenanfragen</h2>

      {inquiries.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">
          Noch keine Anfragen versandt.
        </p>
      ) : (
        <div className="space-y-2">
          {inquiries.map((inquiry) => (
            <div
              key={inquiry.id}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
            >
              <div className="flex items-center gap-3">
                {statusIcons[inquiry.status]}
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {inquiry.supplier.companyName}
                  </p>
                  <p className="text-xs text-gray-500">{inquiry.supplier.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {inquiry.offers.length > 0 && (
                  <span className="text-xs text-green-700 font-medium">
                    {inquiry.offers.length} Angebot
                    {inquiry.offers.length > 1 ? "e" : ""}
                  </span>
                )}
                <span
                  className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full",
                    inquiry.status === "OFFER_RECEIVED"
                      ? "bg-green-100 text-green-700"
                      : inquiry.status === "SENT" || inquiry.status === "OPENED"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                  )}
                >
                  {statusLabels[inquiry.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
