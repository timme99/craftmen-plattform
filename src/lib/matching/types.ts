export type MatchType = "exact" | "semantic" | "unmatched";

export interface LvPosition {
  id: string;
  positionNumber: string;
  shortText: string;
}

export interface ExtractedPos {
  positionNumber: string;
  shortText: string;
  unitPrice?: number | null;
  totalPrice?: number | null;
  notes?: string | null;
}

export interface MatchResult {
  extracted: ExtractedPos;
  positionId: string | null;
  confidence: number;
  matchType: MatchType;
}
