"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { Leaf, Sparkles } from "lucide-react";
import { navItems } from "./nav-items";

interface BrandingProps {
  onNavigate?: () => void;
  logoUrl?: string | null;
  companyName?: string | null;
}

function SidebarContent({ onNavigate, logoUrl, companyName }: BrandingProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-green-950 via-green-900 to-emerald-900 text-white">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center overflow-hidden shadow-sm shadow-green-950/40 shrink-0">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={companyName ?? "Logo"} className="max-w-full max-h-full object-contain" />
            ) : (
              <Leaf className="w-5 h-5 text-green-950" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight tracking-wide truncate">
              {companyName || "CraftMen"}
            </p>
            <p className="text-green-200/90 text-xs leading-tight">Ausschreibungsplattform</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                active
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-green-100/90 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 pb-4">
        <div className="rounded-xl border border-white/15 bg-white/5 p-3">
          <p className="flex items-center gap-2 text-xs text-green-100 font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            Tipp für schnelleres Arbeiten
          </p>
          <p className="mt-1.5 text-xs text-green-100/80 leading-relaxed">
            Öffne ein Projekt und versende Anfragen direkt an mehrere Lieferanten gleichzeitig.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ logoUrl, companyName }: { logoUrl?: string | null; companyName?: string | null }) {
  return (
    <aside className="hidden md:block w-64 flex-shrink-0">
      <SidebarContent logoUrl={logoUrl} companyName={companyName} />
    </aside>
  );
}

export { SidebarContent };
