"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { SidebarContent } from "./Sidebar";
import { sectionTitleForPath } from "./nav-items";

interface Props {
  userEmail: string;
  logoUrl?: string | null;
  companyName?: string | null;
}

export default function TopBar({ userEmail, logoUrl, companyName }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <>
      <header className="h-16 bg-white/95 backdrop-blur border-b border-gray-200 flex items-center justify-between px-4 md:px-8 flex-shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="md:hidden p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
            aria-label="Navigation öffnen"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={companyName ?? "Logo"}
                className="h-8 max-w-32 object-contain hidden sm:block"
              />
            )}
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400 truncate max-w-40">
                {companyName || "CraftMen"}
              </p>
              <p className="text-sm font-medium text-gray-700">{sectionTitleForPath(pathname)}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <p className="text-xs text-gray-500">Angemeldet als</p>
            <p className="text-sm text-gray-700 font-medium truncate max-w-64">{userEmail}</p>
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

      {/* Mobile-Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 w-64 shadow-xl">
            <SidebarContent
              onNavigate={() => setMobileNavOpen(false)}
              logoUrl={logoUrl}
              companyName={companyName}
            />
            <button
              onClick={() => setMobileNavOpen(false)}
              className="absolute top-4 right-3 p-1.5 rounded-lg text-green-100 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              aria-label="Navigation schließen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
