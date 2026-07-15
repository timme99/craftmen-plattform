import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const user = await requireTenant();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;

    if (!file || !projectId) {
      return NextResponse.json(
        { error: "file and projectId are required" },
        { status: 400 }
      );
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: user.tenantId },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Upload to Supabase Storage
    const supabase = await createClient();
    const storagePath = `${user.tenantId}/${projectId}/${Date.now()}-${file.name}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("leistungsverzeichnisse")
      .upload(storagePath, arrayBuffer, { contentType: file.type });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const pythonServiceUrl = process.env.PDF_SERVICE_URL;

    // Create LV record — set PROCESSING immediately if service is configured
    // to avoid a race condition where the callback arrives before the status update
    const lv = await prisma.leistungsverzeichnis.create({
      data: {
        projectId,
        tenantId: user.tenantId,
        fileName: file.name,
        storagePath,
        mimeType: file.type,
        extractionStatus: pythonServiceUrl ? "PROCESSING" : "PENDING",
      },
    });

    if (pythonServiceUrl) {
      fetch(`${pythonServiceUrl}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lvId: lv.id,
          storagePath,
          callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/pdf-extract/callback`,
        }),
      }).catch(console.error);
    }

    return NextResponse.json({ data: lv }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
