import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { requireTenant } from "@/lib/utils/tenant";

const rowSchema = z.object({
  companyName: z.string().min(2).max(100),
  contactName: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  trade: z.string().optional(),
  notes: z.string().optional(),
});

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "text" in v) return String((v as { text: string }).text);
  return String(v).trim();
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireTenant();

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Keine Datei übermittelt" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return NextResponse.json({ error: "Excel-Datei enthält kein Tabellenblatt" }, { status: 400 });
    }

    const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

    // Skip header row (row 1), process from row 2
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const raw = {
        companyName: cellText(row.getCell(1)),
        contactName: cellText(row.getCell(2)) || undefined,
        email: cellText(row.getCell(3)),
        phone: cellText(row.getCell(4)) || undefined,
        address: cellText(row.getCell(5)) || undefined,
        trade: cellText(row.getCell(6)) || undefined,
        notes: cellText(row.getCell(7)) || undefined,
      };

      // Skip fully empty rows
      if (!raw.companyName && !raw.email) return;

      const parsed = rowSchema.safeParse(raw);
      if (!parsed.success) {
        results.errors.push(`Zeile ${rowNumber}: ${parsed.error.issues.map((i) => i.message).join(", ")}`);
        results.skipped++;
        return;
      }

      // Collect for batch upsert — we'll process after eachRow
      (results as unknown as { rows: typeof parsed.data[] }).rows ??= [];
      (results as unknown as { rows: typeof parsed.data[] }).rows.push(parsed.data);
    });

    const rows = (results as unknown as { rows: typeof rowSchema._type[] }).rows ?? [];

    await Promise.all(
      rows.map(async (data) => {
        const existing = await prisma.supplier.findUnique({
          where: { tenantId_email: { tenantId: user.tenantId, email: data.email } },
        });

        if (existing) {
          await prisma.supplier.update({
            where: { id: existing.id },
            data: { ...data, isActive: true },
          });
          results.updated++;
        } else {
          await prisma.supplier.create({
            data: { ...data, tenantId: user.tenantId },
          });
          results.created++;
        }
      })
    );

    return NextResponse.json({ data: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
