import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/utils/tenant";
import { generatePriceComparison } from "@/lib/excel/priceComparison";

export async function GET(req: NextRequest) {
  try {
    const user = await requireTenant();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const buffer = await generatePriceComparison(projectId, user.tenantId);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="preisspiegel-${projectId}.xlsx"`,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
