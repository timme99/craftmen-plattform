"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  companyName: z.string().min(2, "Mindestens 2 Zeichen"),
  contactName: z.string().optional(),
  email: z.string().email("Ungültige E-Mail"),
  phone: z.string().optional(),
  trade: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function CreateSupplierButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setLoading(true);
    const res = await fetch("/api/suppliers", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    setLoading(false);
    if (res.ok) { reset(); setOpen(false); router.refresh(); }
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
        <Plus className="w-4 h-4" />Lieferant anlegen
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Neuer Lieferant</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
              {[
                { name: "companyName" as const, label: "Firma *", placeholder: "Musterbau GmbH" },
                { name: "contactName" as const, label: "Ansprechpartner", placeholder: "Max Mustermann" },
                { name: "email" as const, label: "E-Mail *", placeholder: "info@musterbau.de" },
                { name: "phone" as const, label: "Telefon", placeholder: "+49 123 456789" },
                { name: "trade" as const, label: "Gewerk", placeholder: "Pflasterarbeiten" },
              ].map(({ name, label, placeholder }) => (
                <div key={name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input {...register(name)} placeholder={placeholder}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  {errors[name] && <p className="text-red-500 text-xs mt-1">{errors[name]?.message}</p>}
                </div>
              ))}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-gray-600">Abbrechen</button>
                <button type="submit" disabled={loading}
                  className="bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                  {loading ? "Wird gespeichert…" : "Speichern"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
