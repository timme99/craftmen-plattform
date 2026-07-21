import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  companyName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
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
      return NextResponse.json({ error: "Ungültige Eingaben" }, { status: 400 });
    }
    const { companyName, email, password } = parsed.data;

    const admin = createAdminClient();
    const supabase = await createClient();

    // 1. Create the auth user server-side (email auto-confirmed so the account
    //    is usable immediately and no session-cookie handoff is required).
    let supabaseId: string;
    let createdNewAuthUser = false;

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !created.user) {
      // Most likely the email is already registered. Try to sign in so we can
      // recover an incomplete registration (auth user without tenant); if the
      // password is wrong this fails and we tell them to log in.
      const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError || !signIn.user) {
        return NextResponse.json(
          { error: "Diese E-Mail ist bereits registriert. Bitte melde dich an." },
          { status: 409 }
        );
      }
      supabaseId = signIn.user.id;
    } else {
      supabaseId = created.user.id;
      createdNewAuthUser = true;

      // Establish the session cookie so the user is logged in right away.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        await admin.auth.admin.deleteUser(supabaseId);
        return NextResponse.json(
          { error: "Anmeldung nach der Registrierung fehlgeschlagen" },
          { status: 500 }
        );
      }
    }

    // 2. If this account is already fully set up, we're done (now logged in).
    const { data: existingUser } = await admin
      .from("users")
      .select("id")
      .eq("supabaseId", supabaseId)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ alreadyRegistered: true }, { status: 200 });
    }

    // 3. Create the tenant.
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
      if (createdNewAuthUser) await admin.auth.admin.deleteUser(supabaseId);
      return NextResponse.json({ error: "Tenant-Erstellung fehlgeschlagen" }, { status: 500 });
    }

    // 4. Create the DB user linked to the auth user and tenant.
    const { error: insertUserError } = await admin.from("users").insert({
      tenantId: tenant.id,
      supabaseId,
      email,
      role: "OWNER",
    });

    if (insertUserError) {
      console.error(insertUserError);
      await admin.from("tenants").delete().eq("id", tenant.id);
      if (createdNewAuthUser) await admin.auth.admin.deleteUser(supabaseId);
      return NextResponse.json({ error: "Nutzer-Erstellung fehlgeschlagen" }, { status: 500 });
    }

    return NextResponse.json({ tenantId: tenant.id }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Registrierung fehlgeschlagen" }, { status: 500 });
  }
}
