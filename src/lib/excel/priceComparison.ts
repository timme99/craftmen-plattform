import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma/client";

const BRAND_GREEN = "2D6A4F";
const BRAND_LIGHT = "D8F3DC";

export async function generatePriceComparison(
  projectId: string,
  tenantId: string
): Promise<Buffer> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId },
    include: {
      leistungsverzeichnis: {
        include: {
          positions: {
            orderBy: { sortOrder: "asc" },
            include: {
              offerItems: {
                include: { offer: { include: { inquiry: { include: { supplier: true } } } } },
              },
            },
          },
        },
      },
      inquiries: {
        where: { status: "OFFER_RECEIVED" },
        include: { supplier: true, offers: true },
      },
    },
  });

  if (!project) throw new Error("Project not found");

  const suppliers = project.inquiries.map((i) => i.supplier);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CraftMen Plattform";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Preisspiegel", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  // Header row
  const headerRow = [
    "Pos.",
    "Kurztext",
    "Einheit",
    "Menge",
    ...suppliers.flatMap((s) => [`EP ${s.companyName}`, `GP ${s.companyName}`]),
  ];

  sheet.addRow(["Preisspiegel — " + project.name]).font = {
    bold: true,
    size: 16,
    color: { argb: "FF" + BRAND_GREEN },
  };
  sheet.addRow([`Projekt: ${project.name}`, "", `Stand: ${new Date().toLocaleDateString("de-DE")}`]);
  sheet.addRow([]);

  const header = sheet.addRow(headerRow);
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + BRAND_GREEN } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin" }, left: { style: "thin" },
      bottom: { style: "thin" }, right: { style: "thin" },
    };
  });

  // Data rows
  for (const lv of project.leistungsverzeichnis) {
    for (const pos of lv.positions) {
      const rowData: (string | number | null)[] = [
        pos.positionNumber,
        pos.shortText,
        pos.unit ?? "",
        pos.quantity ? Number(pos.quantity) : null,
      ];

      for (const supplier of suppliers) {
        const offerItem = pos.offerItems.find(
          (oi) => oi.offer.inquiry.supplierId === supplier.id
        );
        rowData.push(offerItem?.unitPrice ? Number(offerItem.unitPrice) : null);
        rowData.push(offerItem?.totalPrice ? Number(offerItem.totalPrice) : null);
      }

      const row = sheet.addRow(rowData);
      row.eachCell((cell, colNum) => {
        if (colNum > 4) {
          cell.numFmt = '#,##0.00 "€"';
        }
        cell.border = {
          top: { style: "thin", color: { argb: "FFCCCCCC" } },
          left: { style: "thin", color: { argb: "FFCCCCCC" } },
          bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
          right: { style: "thin", color: { argb: "FFCCCCCC" } },
        };
      });
    }
  }

  // Totals row
  const totalRow = sheet.addRow([
    "", "GESAMT NETTO", "", "",
    ...suppliers.flatMap(() => ["", null]),
  ]);
  totalRow.font = { bold: true };
  totalRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + BRAND_LIGHT } };

  // Column widths
  sheet.getColumn(1).width = 8;
  sheet.getColumn(2).width = 45;
  sheet.getColumn(3).width = 8;
  sheet.getColumn(4).width = 10;
  suppliers.forEach((_, i) => {
    sheet.getColumn(5 + i * 2).width = 16;
    sheet.getColumn(6 + i * 2).width = 16;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
