"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { use } from "react";

interface Props {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}

const tabs = [
  { label: "Übersicht",  suffix: "" },
  { label: "Positionen", suffix: "/leistungsverzeichnis" },
  { label: "Anfragen",   suffix: "/inquiries" },
  { label: "Preisspiegel", suffix: "/preisspiegel" },
];

export default function ProjectLayout({ children, params }: Props) {
  const { projectId } = use(params);
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  return (
    <div className="space-y-6">
      <nav className="border-b border-gray-200 -mt-2">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const href = base + tab.suffix;
            const isActive = tab.suffix === ""
              ? pathname === href
              : pathname.startsWith(href);
            return (
              <Link
                key={tab.suffix}
                href={href}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-green-600 text-green-700"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
      {children}
    </div>
  );
}
