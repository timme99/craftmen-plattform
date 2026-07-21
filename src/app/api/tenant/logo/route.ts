import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { requireTenant } from "@/lib/utils/tenant";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

const LOGO_BUCKET = "tenant-logos";
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
// SVG bewusst ausgeschlossen: kann eingebettetes Skript enthalten und wird
// in E-Mail-Clients bzw. per <img> aus fremder Quelle geladen.
const ALLOWED_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function canManageBranding(role: string) {
  return role === "OWNER" || role === "ADMIN";
}

// Extrahiert den Objektpfad einer zuvor hochgeladenen Logo-URL, um die alte
// Datei nach einem Wechsel wieder aufräumen zu können.
function storagePathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = `/object/public/${LOGO_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireTenant();
    if (!canManageBranding(user.role)) {
      return NextResponse.json({ error: "Nur Inhaber und Admins dürfen das Logo ändern." }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Keine Datei übermittelt." }, { status: 400 });
    }

    const extension = ALLOWED_MIME[file.type];
    if (!extension) {
      return NextResponse.json(
        { error: "Ungültiges Format. Erlaubt sind PNG, JPG, WEBP oder GIF." },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Die Datei ist zu groß (max. 2 MB)." }, { status: 400 });
    }

    const admin = createAdminClient();

    // Bucket selbst bereitstellen; existiert er bereits, ignorieren wir den Fehler.
    await admin.storage.createBucket(LOGO_BUCKET, {
      public: true,
      fileSizeLimit: MAX_SIZE,
      allowedMimeTypes: Object.keys(ALLOWED_MIME),
    });

    const arrayBuffer = await file.arrayBuffer();
    const objectPath = `${user.tenantId}/logo-${Date.now()}.${extension}`;

    const { error: uploadError } = await admin.storage
      .from(LOGO_BUCKET)
      .upload(objectPath, arrayBuffer, { contentType: file.type, upsert: true });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = admin.storage.from(LOGO_BUCKET).getPublicUrl(objectPath);

    // Vorheriges Logo einlesen, um es nach dem Update zu entfernen.
    const previous = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { logoUrl: true },
    });

    await prisma.tenant.update({
      where: { id: user.tenantId },
      data: { logoUrl: publicUrl },
    });

    const previousPath = storagePathFromUrl(previous?.logoUrl ?? null);
    if (previousPath && previousPath !== objectPath) {
      await admin.storage.from(LOGO_BUCKET).remove([previousPath]);
    }

    await logAudit(user.tenantId, user.id, "TENANT_LOGO_UPDATED", "Tenant", user.tenantId, {});

    return NextResponse.json({ data: { logoUrl: publicUrl } });
  } catch (err) {
    console.error("[tenant/logo] upload failed:", err);
    return NextResponse.json({ error: "Logo konnte nicht gespeichert werden." }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await requireTenant();
    if (!canManageBranding(user.role)) {
      return NextResponse.json({ error: "Nur Inhaber und Admins dürfen das Logo ändern." }, { status: 403 });
    }

    const current = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { logoUrl: true },
    });

    await prisma.tenant.update({
      where: { id: user.tenantId },
      data: { logoUrl: null },
    });

    const path = storagePathFromUrl(current?.logoUrl ?? null);
    if (path) {
      await createAdminClient().storage.from(LOGO_BUCKET).remove([path]);
    }

    await logAudit(user.tenantId, user.id, "TENANT_LOGO_REMOVED", "Tenant", user.tenantId, {});

    return NextResponse.json({ data: { logoUrl: null } });
  } catch (err) {
    console.error("[tenant/logo] delete failed:", err);
    return NextResponse.json({ error: "Logo konnte nicht entfernt werden." }, { status: 500 });
  }
}
