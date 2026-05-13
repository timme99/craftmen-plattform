import type { Metadata } from "next";
import "./globals.css";


export const metadata: Metadata = {
  title: "CraftMen Plattform",
  description:
    "Die SaaS-Lösung für Garten- und Landschaftsbau: Leistungsverzeichnisse digitalisieren, Lieferanten anfragen, Preisspiegel erstellen.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="min-h-full bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
