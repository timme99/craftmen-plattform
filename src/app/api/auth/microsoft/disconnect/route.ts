import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { prisma } from "@/lib/prisma/client";

export async function POST() {
  try {
    const user = await requireTenant();
    await prisma.emailConnection.updateMany({
      where: { tenantId: user.tenantId },
      data: { accessToken: null, refreshToken: null, isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
