export type {
  Tenant,
  User,
  Project,
  Leistungsverzeichnis,
  Position,
  Supplier,
  Inquiry,
  Offer,
  OfferItem,
  EmailConnection,
  PriceComparison,
  Subscription,
  AuditLog,
  PriceAnomaly,
  SupplierScore,
  Invoice,
  InvoiceItem,
  InquiryTemplate,
  BenchmarkEntry,
  Plan,
  UserRole,
  ProjectStatus,
  ExtractionStatus,
  InquiryStatus,
  OfferSource,
  SubscriptionStatus,
} from "@prisma/client";

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PdfExtractionResult {
  positions: ExtractedPosition[];
  rawText: string;
  pageCount: number;
}

export interface ExtractedPosition {
  positionNumber: string;
  shortText: string;
  longText?: string;
  unit?: string;
  quantity?: number;
  trade?: string;
  sortOrder: number;
}

export interface InquiryEmailParams {
  supplierEmail: string;
  supplierName: string;
  projectName: string;
  portalUrl: string;
  deadline?: Date;
  customMessage?: string;
}

export type CopilotItemType =
  | "EXPIRING_INQUIRY"
  | "UNKLAR_MATCH"
  | "MISSING_OFFER"
  | "STALLED_PROJECT"
  | "PRICE_ANOMALY";

export interface CopilotItem {
  priority: "HIGH" | "MEDIUM" | "LOW";
  type: CopilotItemType;
  title: string;
  description: string;
  actionUrl: string;
  entityId: string;
}

export interface BenchmarkBand {
  unitPriceMin: number;
  unitPriceP25: number;
  unitPriceMed: number;
  unitPriceP75: number;
  unitPriceMax: number;
  sampleCount: number;
}

export type MatchType = "exact" | "semantic" | "unmatched";

export interface MatchResult {
  positionId: string | null;
  confidence: number;
  matchType: MatchType;
}
