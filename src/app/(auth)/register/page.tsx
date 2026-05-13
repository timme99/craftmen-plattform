"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Leaf } from "lucide-react";

export default function RegisterPage() {
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

    const isExistingAccount = Boolean(
      data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0
    );

    if (signUpError || !data.user || isExistingAccount) {
      if (isExistingAccount) {
        setError("Diese E-Mail ist bereits registriert. Bitte melde dich an.");
      } else {
        setError(signUpError?.message ?? "Registrierung fehlgeschlagen");
      }
      setLoading(false);
      return;
    }

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName, email, supabaseId: data.user.id }),
    });

    if (!res.ok) {
      let body: { error?: string } = {};
      try {
        body = await res.json();
      } catch {
        // no-op
      }
      setError(body.error ?? "Tenant-Erstellung fehlgeschlagen");
      setLoading(false);
      return;
    }

    router.push("/projects");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 to-green-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-green-700 flex items-center justify-center">
            <Leaf className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">CraftMen Plattform</h1>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-1">Konto erstellen</h2>
        <p className="text-sm text-gray-500 mb-6">
          Starte jetzt mit der automatisierten Anfragenverwaltung.
        </p>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Firmenname</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              minLength={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Musterbau GmbH"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="max@musterbau.de"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Mindestens 8 Zeichen"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {loading ? "Wird registriert…" : "Konto erstellen"}
          </button>
        </form>

        <p className="text-sm text-gray-500 text-center mt-6">
          Bereits ein Konto?{" "}
          <Link href="/login" className="text-green-700 font-medium hover:underline">
            Anmelden
          </Link>
        </p>
      </div>
    </div>
  );
}
