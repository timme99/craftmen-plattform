import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/utils/tenant";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dbUser = await getCurrentTenant();

  if (!dbUser) redirect("/login");

  const logoUrl = dbUser.tenant.logoUrl;
  const companyName = dbUser.tenant.name;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar logoUrl={logoUrl} companyName={companyName} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar userEmail={dbUser.email} logoUrl={logoUrl} companyName={companyName} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
