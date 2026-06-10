"use client";

interface Props {
  confidence: number | null;
  matchType: string | null;
}

export function MatchConfidenceBadge({ confidence, matchType }: Props) {
  if (confidence === null || matchType === null) return null;

  const pct = Math.round(confidence * 100);

  let color: string;
  let label: string;

  if (matchType === "exact" || confidence >= 0.9) {
    color = "bg-green-100 text-green-800 border-green-200";
    label = matchType === "exact" ? "Exakt" : `Semantisch ${pct}%`;
  } else if (confidence >= 0.6) {
    color = "bg-yellow-100 text-yellow-800 border-yellow-200";
    label = `Prüfen ${pct}%`;
  } else {
    color = "bg-red-100 text-red-800 border-red-200";
    label = `Unklar ${pct}%`;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${color}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          matchType === "exact" || confidence >= 0.9
            ? "bg-green-500"
            : confidence >= 0.6
            ? "bg-yellow-500"
            : "bg-red-500"
        }`}
      />
      {label}
    </span>
  );
}
