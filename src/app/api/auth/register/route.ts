import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const schema = z.object({
  companyName: z.string().min(2),
  email: z.string().email(),
  supabaseId: z.string().uuid(),
});

function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }
    const { companyName, email, supabaseId } = parsed.data;

    const admin = createAdminClient();

    const { data: existingUser } = await admin
      .from("users")
      .select("id")
      .eq("supabaseId", supabaseId)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ error: "Nutzer existiert bereits" }, { status: 409 });
    }

    let slug = toSlug(companyName);
    const { data: existingSlug } = await admin
      .from("tenants")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existingSlug) slug = `${slug}-${Date.now()}`;

    const { data: tenant, error: tenantError } = await admin
      .from("tenants")
      .insert({ name: companyName, slug })
      .select("id")
      .single();

    if (tenantError || !tenant) {
      console.error(tenantError);
      return NextResponse.json({ error: "Tenant-Erstellung fehlgeschlagen" }, { status: 500 });
    }

    const { error: userError } = await admin.from("users").insert({
      tenantId: tenant.id,
      supabaseId,
      email,
      role: "OWNER",
    });

    if (userError) {
      console.error(userError);
      await admin.from("tenants").delete().eq("id", tenant.id);
      return NextResponse.json({ error: "Nutzer-Erstellung fehlgeschlagen" }, { status: 500 });
    }

    return NextResponse.json({ tenantId: tenant.id }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Registrierung fehlgeschlagen" }, { status: 500 });
  }
}
