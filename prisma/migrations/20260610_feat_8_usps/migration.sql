-- Migration: feat_8_usps
-- Features: Semantic Matching, Preisanomalien, Supplier Score, Rechnungen, Vorlagen, Benchmark
-- Column names are camelCase to match Prisma field names (no @map annotations in schema)

-- Feature 1: Extend offer_items with match confidence fields
ALTER TABLE "offer_items" ADD COLUMN "matchConfidence" DOUBLE PRECISION;
ALTER TABLE "offer_items" ADD COLUMN "matchType" TEXT;

-- Feature 2: Price anomalies table
CREATE TABLE "price_anomalies" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "projectId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "positionId" UUID,
    "inquiryId" UUID,
    "anomalyType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "value" DECIMAL(12,4),
    "referenceValue" DECIMAL(12,4),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_anomalies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "price_anomalies_projectId_tenantId_idx" ON "price_anomalies"("projectId", "tenantId");
CREATE INDEX "price_anomalies_tenantId_anomalyType_idx" ON "price_anomalies"("tenantId", "anomalyType");

ALTER TABLE "price_anomalies" ADD CONSTRAINT "price_anomalies_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "price_anomalies" ADD CONSTRAINT "price_anomalies_positionId_fkey"
    FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Feature 3: Supplier performance scores
CREATE TABLE "supplier_scores" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "supplierId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "responseRate" DECIMAL(5,4) NOT NULL,
    "deadlineRate" DECIMAL(5,4) NOT NULL,
    "avgMatchQuality" DECIMAL(5,4) NOT NULL,
    "priceStability" DECIMAL(5,4) NOT NULL,
    "totalInquiries" INTEGER NOT NULL DEFAULT 0,
    "totalOffers" INTEGER NOT NULL DEFAULT 0,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_scores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "supplier_scores_supplierId_key" ON "supplier_scores"("supplierId");
CREATE INDEX "supplier_scores_tenantId_idx" ON "supplier_scores"("tenantId");

ALTER TABLE "supplier_scores" ADD CONSTRAINT "supplier_scores_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Feature 4: Invoices and invoice items
CREATE TABLE "invoices" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "projectId" UUID NOT NULL,
    "inquiryId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "totalNet" DECIMAL(12,2) NOT NULL,
    "totalGross" DECIMAL(12,2) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 19,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "invoices_projectId_tenantId_idx" ON "invoices"("projectId", "tenantId");

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_inquiryId_fkey"
    FOREIGN KEY ("inquiryId") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "invoice_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "invoiceId" UUID NOT NULL,
    "positionId" UUID,
    "unitPrice" DECIMAL(12,4) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_positionId_fkey"
    FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Feature 5: Inquiry templates
CREATE TABLE "inquiry_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "trade" TEXT,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "attachmentPath" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inquiry_templates_tenantId_trade_idx" ON "inquiry_templates"("tenantId", "trade");

-- Feature 8: Anonymous benchmark entries
CREATE TABLE "benchmark_entries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "trade" TEXT NOT NULL,
    "positionTextHash" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPriceMin" DECIMAL(12,4) NOT NULL,
    "unitPriceP25" DECIMAL(12,4) NOT NULL,
    "unitPriceMed" DECIMAL(12,4) NOT NULL,
    "unitPriceP75" DECIMAL(12,4) NOT NULL,
    "unitPriceMax" DECIMAL(12,4) NOT NULL,
    "sampleCount" INTEGER NOT NULL,
    "region" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benchmark_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "benchmark_entries_trade_positionTextHash_unit_key"
    ON "benchmark_entries"("trade", "positionTextHash", "unit");
CREATE INDEX "benchmark_entries_trade_unit_idx" ON "benchmark_entries"("trade", "unit");
