import { FolderOpen, Users, Settings, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { href: "/projects", label: "Projekte", icon: FolderOpen },
  { href: "/suppliers", label: "Lieferanten", icon: Users },
  { href: "/settings", label: "Einstellungen", icon: Settings },
];

/** Seitentitel für die TopBar anhand des Pfads. */
export function sectionTitleForPath(pathname: string): string {
  if (pathname.startsWith("/projects/")) return "Projektdetails";
  const item = navItems.find((nav) => pathname.startsWith(nav.href));
  return item?.label ?? "Dashboard";
}
