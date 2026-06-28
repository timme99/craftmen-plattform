import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ExtractedPosition } from "@/types";

/**
 * Zentrale Claude-Anbindung (Node-seitig) für die KI-Assistenzfunktionen der App.
 * Der Python-PDF-Service nutzt Claude weiterhin als Hauptpfad; dieser Client liefert
 * die nutzergesteuerte KI-Ebene (E-Mail-Entwurf, Zuordnung, Angebotsvergleich) sowie
 * die Backup-Extraktion.
 *
 * Konvention angelehnt an src/lib/graph/client.ts (Factory + getypte Helfer).
 */

export const AI_MODEL = "claude-opus-4-8";

/** True, wenn ein API-Key konfiguriert ist (zum Ausblenden der Buttons / 503-Antwort). */
export function isAiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Factory – liest ANTHROPIC_API_KEY aus der Umgebung. */
export function createAnthropicClient(): Anthropic {
  return new Anthropic();
}

// ─── Feature 1: Anfrage-E-Mail vorformulieren ──────────────────────────────────────

const emailDraftSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

export type InquiryEmailDraft = z.infer<typeof emailDraftSchema>;

export interface DraftInquiryEmailInput {
  projectName: string;
  projectDescription?: string | null;
  projectLocation?: string | null;
  supplierCompany: string;
  supplierContact?: string | null;
  supplierTrade?: string | null;
  deadline?: Date | null;
  positions: Array<{ positionNumber: string; shortText: string; quantity?: string | null; unit?: string | null }>;
  tone?: string | null;
  notes?: string | null;
}

export async function draftInquiryEmail(input: DraftInquiryEmailInput): Promise<InquiryEmailDraft> {
  const client = createAnthropicClient();

  const positionsList = input.positions.length
    ? input.positions
        .map((p) => `- ${p.positionNumber}: ${p.shortText} (${p.quantity ?? "?"} ${p.unit ?? ""})`.trim())
        .join("\n")
    : "(noch keine Positionen zugewiesen)";

  const message = await client.messages.parse({
    model: AI_MODEL,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: zodOutputFormat(emailDraftSchema) },
    system:
      "Du bist Assistent eines deutschen Garten- und Landschaftsbaubetriebs. Du formulierst " +
      "professionelle, höfliche Anfrage-E-Mails an Lieferanten/Nachunternehmer auf Deutsch (Sie-Form). " +
      "Der Text soll knapp und konkret sein, das Gewerk des Lieferanten berücksichtigen und zur Angebotsabgabe " +
      "für die genannten Positionen einladen. Keine Platzhalter wie [Name] verwenden – nutze die gegebenen Daten. " +
      "Der 'body' ist eine persönliche Nachricht (Fließtext, kein HTML), die in eine bestehende E-Mail-Vorlage " +
      "eingebettet wird; wiederhole daher KEINE Positionstabelle und KEINEN Portal-Link.",
    messages: [
      {
        role: "user",
        content:
          `Projekt: ${input.projectName}\n` +
          (input.projectLocation ? `Ort: ${input.projectLocation}\n` : "") +
          (input.projectDescription ? `Beschreibung: ${input.projectDescription}\n` : "") +
          `\nLieferant: ${input.supplierCompany}\n` +
          (input.supplierContact ? `Ansprechpartner: ${input.supplierContact}\n` : "") +
          (input.supplierTrade ? `Gewerk: ${input.supplierTrade}\n` : "") +
          (input.deadline ? `Angebotsfrist: ${input.deadline.toLocaleDateString("de-DE")}\n` : "") +
          (input.tone ? `Gewünschter Tonfall: ${input.tone}\n` : "") +
          (input.notes ? `Zusätzliche Hinweise: ${input.notes}\n` : "") +
          `\nAusgeschriebene Positionen:\n${positionsList}`,
      },
    ],
  });

  if (!message.parsed_output) throw new Error("Claude lieferte keine verwertbare Antwort.");
  return message.parsed_output;
}

// ─── Feature 2: Positions-Lieferanten-Zuordnung vorschlagen ────────────────────────

const assignmentSuggestionsSchema = z.object({
  suggestions: z.array(
    z.object({
      positionId: z.string(),
      suggestedSupplierIds: z.array(z.string()),
      reason: z.string(),
      confidence: z.number(),
    })
  ),
});

export type AssignmentSuggestions = z.infer<typeof assignmentSuggestionsSchema>;

export interface SuggestAssignmentsInput {
  positions: Array<{ id: string; positionNumber: string; shortText: string; longText?: string | null; trade?: string | null }>;
  suppliers: Array<{ id: string; companyName: string; trade?: string | null }>;
}

export async function suggestPositionAssignments(input: SuggestAssignmentsInput): Promise<AssignmentSuggestions> {
  const client = createAnthropicClient();

  const positionsBlock = input.positions
    .map(
      (p) =>
        `- id=${p.id} | Pos ${p.positionNumber} | ${p.shortText}${p.trade ? ` | Gewerk: ${p.trade}` : ""}${
          p.longText ? ` | Detail: ${p.longText.slice(0, 200)}` : ""
        }`
    )
    .join("\n");
  const suppliersBlock = input.suppliers
    .map((s) => `- id=${s.id} | ${s.companyName}${s.trade ? ` | Gewerk: ${s.trade}` : ""}`)
    .join("\n");

  const message = await client.messages.parse({
    model: AI_MODEL,
    max_tokens: 8192,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: zodOutputFormat(assignmentSuggestionsSchema) },
    system:
      "Du unterstützt einen Garten-/Landschaftsbaubetrieb bei der Vergabe. Ordne LV-Positionen den " +
      "passendsten Lieferanten zu – primär nach Gewerk/Fachbereich und Textinhalt. Verwende AUSSCHLIESSLICH " +
      "die gegebenen id-Werte (keine erfundenen IDs). Pro Position 0–3 Vorschläge, beste zuerst. " +
      "confidence ist eine Zahl zwischen 0 und 1. 'reason' kurz auf Deutsch. Lasse Positionen ohne plausiblen " +
      "Lieferanten mit leerer suggestedSupplierIds-Liste.",
    messages: [
      {
        role: "user",
        content: `LIEFERANTEN:\n${suppliersBlock || "(keine)"}\n\nPOSITIONEN:\n${positionsBlock || "(keine)"}`,
      },
    ],
  });

  if (!message.parsed_output) throw new Error("Claude lieferte keine verwertbare Antwort.");
  return message.parsed_output;
}

// ─── Feature 3: Angebotsvergleich + Next Steps ─────────────────────────────────────

const offerAnalysisSchema = z.object({
  ranking: z.array(
    z.object({
      supplierId: z.string(),
      companyName: z.string(),
      rank: z.number(),
      totalNet: z.number().nullable(),
      rationale: z.string(),
    })
  ),
  risks: z.array(
    z.object({
      severity: z.enum(["HIGH", "MEDIUM", "LOW"]),
      description: z.string(),
    })
  ),
  recommendation: z.string(),
  nextSteps: z.array(z.string()),
});

export type OfferAnalysis = z.infer<typeof offerAnalysisSchema>;

export interface AnalyzeOffersInput {
  projectName: string;
  positionCount: number;
  suppliers: Array<{
    id: string;
    companyName: string;
    totalNet: number | null;
    itemCount: number;
    deadlineMet?: boolean | null;
    score?: {
      responseRate: number;
      deadlineRate: number;
      avgMatchQuality: number;
      priceStability: number;
    } | null;
  }>;
  positions: Array<{ positionNumber: string; shortText: string; prices: Array<{ supplierId: string; unitPrice: number | null }> }>;
}

export async function analyzeOffers(input: AnalyzeOffersInput): Promise<OfferAnalysis> {
  const client = createAnthropicClient();

  const suppliersBlock = input.suppliers
    .map((s) => {
      const score = s.score
        ? ` | Antwortrate ${(s.score.responseRate * 100).toFixed(0)}% | Termintreue ${(s.score.deadlineRate * 100).toFixed(0)}% | Match-Qualität ${(s.score.avgMatchQuality * 100).toFixed(0)}% | Preisstabilität ${(s.score.priceStability * 100).toFixed(0)}%`
        : " | kein Score";
      return `- id=${s.id} | ${s.companyName} | Summe netto: ${s.totalNet ?? "?"} EUR | ${s.itemCount} Positionen bepreist${score}`;
    })
    .join("\n");

  const pricesBlock = input.positions
    .map((p) => {
      const prices = p.prices.map((pr) => `${pr.supplierId}=${pr.unitPrice ?? "?"}`).join(", ");
      return `- ${p.positionNumber} ${p.shortText}: ${prices}`;
    })
    .join("\n");

  const message = await client.messages.parse({
    model: AI_MODEL,
    max_tokens: 8192,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: zodOutputFormat(offerAnalysisSchema) },
    system:
      "Du bist Vergabe-Analyst eines Garten-/Landschaftsbaubetriebs. Vergleiche die Angebote sachlich auf Deutsch. " +
      "Erstelle ein Ranking (rank=1 ist die Empfehlung), benenne Risiken (z.B. Preis-Ausreißer, unvollständige " +
      "Bepreisung, schlechte Termintreue) und konkrete nächste Schritte. Berücksichtige nicht nur den Preis, " +
      "sondern auch Vollständigkeit und Lieferanten-Score (z.B. '8% teurer, aber 95% Termintreue'). " +
      "Verwende ausschließlich die gegebenen supplierId-Werte. totalNet als Zahl oder null.",
    messages: [
      {
        role: "user",
        content:
          `Projekt: ${input.projectName} (${input.positionCount} Positionen im LV)\n\n` +
          `ANGEBOTE JE LIEFERANT:\n${suppliersBlock || "(keine)"}\n\n` +
          `EINHEITSPREISE JE POSITION (supplierId=Einzelpreis):\n${pricesBlock || "(keine)"}`,
      },
    ],
  });

  if (!message.parsed_output) throw new Error("Claude lieferte keine verwertbare Antwort.");
  return message.parsed_output;
}

// ─── Feature 4: Backup-Extraktion aus PDF (LV-Positionen / Angebote) ────────────────

const extractedPositionSchema = z.object({
  positionNumber: z.string(),
  shortText: z.string(),
  longText: z.string().nullable(),
  unit: z.string().nullable(),
  quantity: z.number().nullable(),
  trade: z.string().nullable(),
  sortOrder: z.number(),
  unitPrice: z.number().nullable(),
  totalPrice: z.number().nullable(),
});

const pdfExtractionSchema = z.object({
  positions: z.array(extractedPositionSchema),
});

/** Vom PDF extrahierte Position inkl. optionaler Preise (für Angebots-Backup). */
export type ExtractedPdfPosition = z.infer<typeof extractedPositionSchema>;

/**
 * Liest Positionen (und ggf. Preise) per Claude direkt aus einem PDF aus.
 * Genutzt als Backup, wenn der reguläre Extraktionspfad fehlschlägt.
 * Streaming wegen potenziell großem Output.
 */
export async function extractPositionsFromPdf(
  pdfBuffer: Buffer,
  opts?: { withPrices?: boolean }
): Promise<ExtractedPdfPosition[]> {
  const client = createAnthropicClient();

  const priceHint = opts?.withPrices
    ? "Erfasse zusätzlich Einzelpreis (unitPrice) und Gesamtpreis (totalPrice) je Position, falls im Dokument enthalten."
    : "Setze unitPrice und totalPrice auf null (reines Leistungsverzeichnis ohne Preise).";

  const stream = client.messages.stream({
    model: AI_MODEL,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: zodOutputFormat(pdfExtractionSchema) },
    system:
      "Du extrahierst strukturierte Positionsdaten aus einem deutschen Leistungsverzeichnis (LV) bzw. " +
      "Angebots-PDF eines Garten-/Landschaftsbaubetriebs. Gib jede Position einzeln zurück. " +
      "positionNumber wie im Dokument (z.B. '1.1', '2.3.1'), shortText = Kurztext, longText = Detailtext oder null, " +
      "unit = Einheit (m², m³, Stk, …) oder null, quantity = Menge als Zahl oder null, trade = Gewerk oder null, " +
      "sortOrder = laufende Reihenfolge ab 0. " +
      priceHint,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdfBuffer.toString("base64") },
          },
          { type: "text", text: "Extrahiere alle Positionen aus diesem Dokument." },
        ],
      },
    ],
  });

  const final = await stream.finalMessage();
  const text = final.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Claude lieferte kein gültiges JSON für die PDF-Extraktion.");
  }
  return pdfExtractionSchema.parse(parsed).positions;
}

/** Mappt das interne Extraktionsformat auf den ExtractedPosition-Typ der App (ohne Preise). */
export function toExtractedPositions(positions: ExtractedPdfPosition[]): ExtractedPosition[] {
  return positions.map((p) => ({
    positionNumber: p.positionNumber,
    shortText: p.shortText,
    longText: p.longText ?? undefined,
    unit: p.unit ?? undefined,
    quantity: p.quantity ?? undefined,
    trade: p.trade ?? undefined,
    sortOrder: p.sortOrder,
  }));
}
