"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  FolderOpen,
  Users,
  Settings,
  BarChart3,
  Leaf,
} from "lucide-react";

const navItems = [
  { href: "/projects", label: "Projekte", icon: FolderOpen },
  { href: "/suppliers", label: "Lieferanten", icon: Users },
  { href: "/settings", label: "Einstellungen", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 flex-shrink-0 bg-green-900 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-green-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-400 flex items-center justify-center">
            <Leaf className="w-5 h-5 text-green-900" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">CraftMen</p>
            <p className="text-green-400 text-xs leading-tight">Plattform</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-green-700 text-white"
                  : "text-green-300 hover:bg-green-800 hover:text-white"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-green-800">
      </div>
    </aside>
  );
}
