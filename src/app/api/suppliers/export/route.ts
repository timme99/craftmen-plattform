import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma/client";
import { requireTenant } from "@/lib/utils/tenant";

const BRAND_GREEN = "2D6A4F";

export async function GET() {
  try {
    const user = await requireTenant();

    const suppliers = await prisma.supplier.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      orderBy: { companyName: "asc" },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CraftMen Plattform";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Lieferanten");

    const columns = [
      { header: "Firma *", key: "companyName", width: 30 },
      { header: "Anrede", key: "salutation", width: 12 },
      { header: "Ansprechpartner", key: "contactName", width: 25 },
      { header: "E-Mail *", key: "email", width: 30 },
      { header: "Telefon", key: "phone", width: 20 },
      { header: "Adresse", key: "address", width: 35 },
      { header: "Gewerk", key: "trade", width: 20 },
      { header: "Notizen", key: "notes", width: 40 },
    ];

    sheet.columns = columns;

    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + BRAND_GREEN } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle", horizontal: "left" };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
      };
    });
    headerRow.height = 22;

    for (const s of suppliers) {
      const row = sheet.addRow({
        companyName: s.companyName,
        salutation: s.salutation === "HERR" ? "Herr" : s.salutation === "FRAU" ? "Frau" : "",
        contactName: s.contactName ?? "",
        email: s.email,
        phone: s.phone ?? "",
        address: s.address ?? "",
        trade: s.trade ?? "",
        notes: s.notes ?? "",
      });
      row.eachCell((cell) => {
        cell.alignment = { vertical: "middle" };
      });
    }

    // Add an empty example row if no suppliers exist
    if (suppliers.length === 0) {
      sheet.addRow({
        companyName: "Musterbau GmbH",
        contactName: "Max Mustermann",
        email: "info@musterbau.de",
        phone: "+49 123 456789",
        address: "Musterstraße 1, 12345 Berlin",
        trade: "Pflasterarbeiten",
        notes: "",
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="lieferanten-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
