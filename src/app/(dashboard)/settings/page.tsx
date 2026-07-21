import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import DisconnectMicrosoftButton from "@/components/forms/DisconnectMicrosoftButton";
import TenantLogoUploader from "@/components/forms/TenantLogoUploader";
import { CheckCircle, AlertCircle, Mail, Building2, Users } from "lucide-react";

const errorMessages: Record<string, string> = {
  no_code: "Microsoft hat keinen Autorisierungscode zurückgegeben.",
  token_exchange: "Der Token-Austausch mit Microsoft ist fehlgeschlagen. Bitte versuche es erneut.",
  invalid_state: "Die Sitzung ist abgelaufen. Bitte starte die Verbindung erneut.",
  no_mailbox:
    "Dieses Microsoft-Konto hat kein Postfach zum Senden. Bitte verbinde das Konto, unter dem du deine E-Mails empfängst (privates Outlook oder Firmen-Microsoft-365) – wähle es im Anmeldedialog gezielt aus.",
  unknown: "Ein unbekannter Fehler ist aufgetreten. Bitte versuche es erneut.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const user = await requireTenant();

  const [emailConn, teamMembers] = await Promise.all([
    prisma.emailConnection.findUnique({ where: { tenantId: user.tenantId } }),
    prisma.user.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const isConnected = !!(emailConn?.accessToken && emailConn?.isActive);

  const roleLabels: Record<string, string> = {
    OWNER: "Inhaber",
    ADMIN: "Admin",
    MEMBER: "Mitglied",
    VIEWER: "Betrachter",
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Einstellungen</h1>
        <p className="text-sm text-gray-500 mt-1">Konto und Integrationen verwalten</p>
      </div>

      {success === "connected" && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>Microsoft Outlook wurde erfolgreich verbunden.</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessages[error] ?? "Ein Fehler ist aufgetreten."}</span>
        </div>
      )}

      {/* Microsoft / Outlook */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">Microsoft Outlook</h2>
        </div>

        {isConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-4 py-3">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>
                Verbunden als <strong>{emailConn!.emailAddress}</strong>
              </span>
            </div>
            <DisconnectMicrosoftButton />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0 text-orange-400" />
              <span>Kein Outlook-Konto verbunden. Wähle den passenden Kontotyp, um E-Mails automatisch zu senden und zu empfangen.</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href="/api/auth/microsoft?type=personal"
                className="inline-flex items-center justify-center gap-2 bg-[#0078D4] hover:bg-[#106EBE] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 23 23" fill="none">
                  <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
                  <rect x="12" y="1" width="10" height="10" fill="#7FBA00"/>
                  <rect x="1" y="12" width="10" height="10" fill="#00A4EF"/>
                  <rect x="12" y="12" width="10" height="10" fill="#FFB900"/>
                </svg>
                Privates Outlook verbinden
              </a>
              <a
                href="/api/auth/microsoft?type=work"
                className="inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 23 23" fill="none">
                  <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
                  <rect x="12" y="1" width="10" height="10" fill="#7FBA00"/>
                  <rect x="1" y="12" width="10" height="10" fill="#00A4EF"/>
                  <rect x="12" y="12" width="10" height="10" fill="#FFB900"/>
                </svg>
                Firma (Microsoft 365) verbinden
              </a>
            </div>
            <p className="text-xs text-gray-400">
              Privat: outlook.com, hotmail.de, live.de. Firma: dein geschäftliches Microsoft-365-Konto.
            </p>
          </div>
        )}
      </section>

      {/* Firmen-Profil */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">Firmen-Profil</h2>
        </div>

        <div>
          <p className="text-xs text-gray-400 mb-2">Firmenlogo</p>
          <TenantLogoUploader
            logoUrl={user.tenant.logoUrl}
            canManage={user.role === "OWNER" || user.role === "ADMIN"}
          />
          <p className="text-xs text-gray-400 mt-2">
            Das Logo erscheint in der App sowie in den Anfrage-E-Mails an Ihre Lieferanten.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Firmenname</p>
            <p className="text-sm font-medium text-gray-900">{user.tenant.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Kürzel (Slug)</p>
            <p className="text-sm font-mono text-gray-700">{user.tenant.slug}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Plan</p>
            <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              {user.tenant.plan}
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-400">Firmendaten können derzeit nicht geändert werden. Wende dich an den Support.</p>
      </section>

      {/* Team-Mitglieder */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">Team-Mitglieder</h2>
        </div>
        <div className="space-y-2">
          {teamMembers.map((member) => (
            <div key={member.id} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {member.firstName || member.lastName
                    ? `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim()
                    : member.email}
                </p>
                <p className="text-xs text-gray-400">{member.email}</p>
              </div>
              <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {roleLabels[member.role] ?? member.role}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
