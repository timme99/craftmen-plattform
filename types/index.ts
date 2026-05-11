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
