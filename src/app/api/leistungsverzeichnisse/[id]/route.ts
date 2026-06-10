import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

interface Params {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireTenant();
    const { id } = await params;

    const lv = await prisma.leistungsverzeichnis.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!lv) {
      return NextResponse.json({ error: "LV nicht gefunden" }, { status: 404 });
    }

    // Deleting an LV cascades to its positions and their offer items.
    // Block deletion if offers reference these positions to avoid silently
    // destroying submitted offer data.
    const linkedOfferItems = await prisma.offerItem.count({
      where: { position: { leistungsverzeichnisId: id } },
    });
    if (linkedOfferItems > 0) {
      return NextResponse.json(
        {
          error:
            "Dieses LV kann nicht gelöscht werden, weil bereits Angebote zu seinen Positionen vorliegen.",
        },
        { status: 409 }
      );
    }

    await prisma.leistungsverzeichnis.delete({ where: { id } });

    // Best-effort: remove the PDF from storage
    if (lv.storagePath) {
      const supabase = await createClient();
      await supabase.storage
        .from("leistungsverzeichnisse")
        .remove([lv.storagePath]);
    }

    await logAudit(user.tenantId, user.id, "LV_DELETED", "Leistungsverzeichnis", id, {
      fileName: lv.fileName,
      extractionStatus: lv.extractionStatus,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Löschen fehlgeschlagen" }, { status: 500 });
  }
}
