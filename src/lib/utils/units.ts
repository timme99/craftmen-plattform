// Kanonische Einheiten für LV-Positionen. Wird in UI, API-Routen und
// (gespiegelt) im Python-PDF-Service verwendet — Änderungen dort nachziehen
// (services/pdf-service/main.py: ALLOWED_UNITS / UNIT_ALIAS_MAP).
export const CANONICAL_UNITS = [
  "m²",
  "m³",
  "m",
  "lfm",
  "km",
  "Stk",
  "psch",
  "t",
  "kg",
  "g",
  "l",
  "h",
  "Tag",
] as const;

// Aliase: Schlüssel lowercase und ohne Punkte
const UNIT_ALIASES: Record<string, string> = {
  m2: "m²",
  qm: "m²",
  m3: "m³",
  cbm: "m³",
  lm: "lfm",
  lfdm: "lfm",
  "lfd m": "lfm",
  laufmeter: "lfm",
  st: "Stk",
  stk: "Stk",
  stck: "Stk",
  stück: "Stk",
  stueck: "Stk",
  psch: "psch",
  pausch: "psch",
  pauschal: "psch",
  std: "h",
  stunde: "h",
  stunden: "h",
  to: "t",
  tonne: "t",
  tonnen: "t",
  liter: "l",
  tag: "Tag",
  tage: "Tag",
};

const canonicalByLowercase = new Map(CANONICAL_UNITS.map((unit) => [unit.toLowerCase(), unit]));

/**
 * Normalisiert eine Einheiten-Eingabe auf die kanonische Schreibweise
 * (z.B. "m2" → "m²", "Stück" → "Stk"). Unbekannte Einheiten bleiben erhalten,
 * leere Eingaben werden zu null.
 */
export function normalizeUnit(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  const key = trimmed.replace(/\./g, "").toLowerCase();
  return UNIT_ALIASES[key] ?? canonicalByLowercase.get(key) ?? trimmed;
}

export function isKnownUnit(unit: string | null | undefined): boolean {
  const normalized = normalizeUnit(unit);
  return normalized != null && (CANONICAL_UNITS as readonly string[]).includes(normalized);
}

const NUMBER_LIKE = /^[\d.,\s]+$/;

/**
 * Heuristische Prüfung einer Position auf verdächtige Einheit/Menge-Werte.
 * Liefert deutsche Warnmeldungen für die Anzeige (leer = alles plausibel).
 */
export function getPositionWarnings(position: {
  unit: string | null;
  quantity: number | null;
}): string[] {
  const warnings: string[] = [];
  const unit = position.unit?.trim() ?? "";

  if (unit === "") {
    warnings.push("Einheit fehlt");
  } else if (NUMBER_LIKE.test(unit)) {
    warnings.push("Einheit sieht wie eine Menge aus – Werte vertauscht?");
  } else if (!isKnownUnit(unit)) {
    warnings.push("Unbekannte Einheit");
  }

  if (position.quantity == null) {
    warnings.push("Menge fehlt");
  }

  return warnings;
}
