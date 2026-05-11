import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
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

    const existing = await prisma.user.findUnique({ where: { supabaseId } });
    if (existing) return NextResponse.json({ error: "Nutzer existiert bereits" }, { status: 409 });

    let slug = toSlug(companyName);
    const slugExists = await prisma.tenant.findUnique({ where: { slug } });
    if (slugExists) slug = `${slug}-${Date.now()}`;

    const tenant = await prisma.tenant.create({
      data: {
        name: companyName,
        slug,
        users: {
          create: {
            supabaseId,
            email,
            role: "OWNER",
          },
        },
      },
    });

    return NextResponse.json({ tenantId: tenant.id }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Registrierung fehlgeschlagen" }, { status: 500 });
  }
}
