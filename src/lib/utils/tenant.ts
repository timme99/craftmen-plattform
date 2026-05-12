import { prisma } from "@/lib/prisma/client";
import { createClient } from "@/lib/supabase/server";

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
  const user = await getCurrentTenant();
  if (!user) throw new Error("Unauthorized");
  return user;
}
