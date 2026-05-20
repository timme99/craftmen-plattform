"use client";

import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

interface Props {
  user: User;
}

export default function TopBar({ user }: Props) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="h-16 bg-white/95 backdrop-blur border-b border-gray-200 flex items-center justify-between px-6 md:px-8 flex-shrink-0 sticky top-0 z-20">
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400">Dashboard</p>
        <p className="text-sm font-medium text-gray-700">Willkommen zurück</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:block text-right">
          <p className="text-xs text-gray-500">Angemeldet als</p>
          <p className="text-sm text-gray-700 font-medium truncate max-w-64">{user.email}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
          title="Abmelden"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
