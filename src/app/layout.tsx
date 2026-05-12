import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "CraftMen Plattform",
  description:
    "Die SaaS-Lösung für Garten- und Landschaftsbau: Leistungsverzeichnisse digitalisieren, Lieferanten anfragen, Preisspiegel erstellen.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
