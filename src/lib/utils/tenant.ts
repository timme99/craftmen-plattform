import { prisma } from "@/lib/prisma/client";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function getCurrentTenant() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
      include: { tenant: true },
    });
    return dbUser;
  } catch {
    return null;
  }
}

export async function requireTenant() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) redirect("/login");

  const dbUser = await prisma.user
    .findUnique({ where: { supabaseId: user.id }, include: { tenant: true } })
    .catch(() => {
      throw new Error("Datenbankverbindung fehlgeschlagen. Bitte versuche es erneut.");
    });

  if (!dbUser) throw new Error("Benutzerkonto unvollständig. Bitte registriere dich erneut.");

  return dbUser;
}
