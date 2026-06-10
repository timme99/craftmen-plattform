import type { ExtractedPos, LvPosition, MatchResult } from "./types";

const DE_STOPWORDS = new Set([
  "die", "der", "das", "und", "für", "mit", "von", "aus", "nach", "in",
  "an", "auf", "ist", "ein", "eine", "einer", "eines", "dem", "den",
  "des", "zu", "bei", "als", "am", "im", "zum", "zur", "oder", "je",
  "pro", "nach", "gem", "gemäß", "inkl", "exkl",
]);

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,\-\/\\()\[\]{}:;!?]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !DE_STOPWORDS.has(t))
    .join(" ")
    .trim();
}

export function termOverlapScore(a: string, b: string): number {
  const tokensA = new Set(normalizeText(a).split(" ").filter(Boolean));
  const tokensB = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokensA) if (tokensB.has(t)) intersection++;
  const union = tokensA.size + tokensB.size - intersection;
  return intersection / union;
}

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

export function normalizedLevenshtein(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(na, nb) / maxLen;
}

export function semanticScore(a: string, b: string): number {
  return 0.6 * termOverlapScore(a, b) + 0.4 * normalizedLevenshtein(a, b);
}

export function matchExtractedPositions(
  extracted: ExtractedPos[],
  lvPositions: LvPosition[]
): MatchResult[] {
  const positionMap = new Map(lvPositions.map((p) => [p.positionNumber, p]));

  return extracted.map((ext): MatchResult => {
    // 1. Try exact position number match
    const exactMatch = positionMap.get(ext.positionNumber);
    if (exactMatch) {
      return {
        extracted: ext,
        positionId: exactMatch.id,
        confidence: 1.0,
        matchType: "exact",
      };
    }

    // 2. Semantic fallback: score against all LV positions by shortText
    let bestScore = 0;
    let bestPosition: LvPosition | null = null;
    for (const lv of lvPositions) {
      const score = semanticScore(ext.shortText, lv.shortText);
      if (score > bestScore) {
        bestScore = score;
        bestPosition = lv;
      }
    }

    if (bestScore >= 0.4 && bestPosition) {
      return {
        extracted: ext,
        positionId: bestPosition.id,
        confidence: bestScore,
        matchType: "unmatched",
      };
    }

    return {
      extracted: ext,
      positionId: null,
      confidence: bestScore,
      matchType: "unmatched",
    };
  });
}
