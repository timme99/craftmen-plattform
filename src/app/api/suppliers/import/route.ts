import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { requireTenant } from "@/lib/utils/tenant";

const rowSchema = z.object({
  companyName: z.string().min(2).max(100),
  salutation: z.enum(["HERR", "FRAU"]).optional(),
  contactName: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  trade: z.string().optional(),
  notes: z.string().optional(),
});

type RowData = z.infer<typeof rowSchema>;

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "text" in v) return String((v as { text: string }).text);
  return String(v).trim();
}

// Freitext-Anrede aus der Excel-Spalte auf das Enum abbilden; unbekannte
// Werte werden ignoriert, damit der Import nicht daran scheitert.
function parseSalutation(value: string): "HERR" | "FRAU" | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized === "herr") return "HERR";
  if (normalized === "frau") return "FRAU";
  return undefined;
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

    const validRows: RowData[] = [];
    const errors: string[] = [];
    let skipped = 0;

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const raw = {
        companyName: cellText(row.getCell(1)),
        salutation: parseSalutation(cellText(row.getCell(2))),
        contactName: cellText(row.getCell(3)) || undefined,
        email: cellText(row.getCell(4)),
        phone: cellText(row.getCell(5)) || undefined,
        address: cellText(row.getCell(6)) || undefined,
        trade: cellText(row.getCell(7)) || undefined,
        notes: cellText(row.getCell(8)) || undefined,
      };

      if (!raw.companyName && !raw.email) return;

      const parsed = rowSchema.safeParse(raw);
      if (!parsed.success) {
        errors.push(`Zeile ${rowNumber}: ${parsed.error.issues.map((i) => i.message).join(", ")}`);
        skipped++;
        return;
      }

      validRows.push(parsed.data);
    });

    let created = 0;
    let updated = 0;

    await Promise.all(
      validRows.map(async (data) => {
        const existing = await prisma.supplier.findUnique({
          where: { tenantId_email: { tenantId: user.tenantId, email: data.email } },
        });

        if (existing) {
          await prisma.supplier.update({
            where: { id: existing.id },
            data: { ...data, isActive: true },
          });
          updated++;
        } else {
          await prisma.supplier.create({
            data: { ...data, tenantId: user.tenantId },
          });
          created++;
        }
      })
    );

    return NextResponse.json({ data: { created, updated, skipped, errors } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
