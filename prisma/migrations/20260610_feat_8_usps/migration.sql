-- Migration: feat_8_usps
-- Features: Semantic Matching, Preisanomalien, Supplier Score, Rechnungen, Vorlagen, Benchmark

-- Feature 1: Extend offer_items with match confidence fields
ALTER TABLE "offer_items" ADD COLUMN "match_confidence" DOUBLE PRECISION;
ALTER TABLE "offer_items" ADD COLUMN "match_type" TEXT;

-- Feature 2: Price anomalies table
CREATE TABLE "price_anomalies" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "position_id" TEXT,
    "inquiry_id" TEXT,
    "anomaly_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "value" DECIMAL(12,4),
    "reference_value" DECIMAL(12,4),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_anomalies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "price_anomalies_project_id_tenant_id_idx" ON "price_anomalies"("project_id", "tenant_id");
CREATE INDEX "price_anomalies_tenant_id_anomaly_type_idx" ON "price_anomalies"("tenant_id", "anomaly_type");

ALTER TABLE "price_anomalies" ADD CONSTRAINT "price_anomalies_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "price_anomalies" ADD CONSTRAINT "price_anomalies_position_id_fkey"
    FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Feature 3: Supplier performance scores
CREATE TABLE "supplier_scores" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "response_rate" DECIMAL(5,4) NOT NULL,
    "deadline_rate" DECIMAL(5,4) NOT NULL,
    "avg_match_quality" DECIMAL(5,4) NOT NULL,
    "price_stability" DECIMAL(5,4) NOT NULL,
    "total_inquiries" INTEGER NOT NULL DEFAULT 0,
    "total_offers" INTEGER NOT NULL DEFAULT 0,
    "last_calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_scores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "supplier_scores_supplier_id_key" ON "supplier_scores"("supplier_id");
CREATE INDEX "supplier_scores_tenant_id_idx" ON "supplier_scores"("tenant_id");

ALTER TABLE "supplier_scores" ADD CONSTRAINT "supplier_scores_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Feature 4: Invoices and invoice items
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "total_net" DECIMAL(12,2) NOT NULL,
    "total_gross" DECIMAL(12,2) NOT NULL,
    "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 19,
    "issued_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "invoices_project_id_tenant_id_idx" ON "invoices"("project_id", "tenant_id");

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_inquiry_id_fkey"
    FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "position_id" TEXT,
    "unit_price" DECIMAL(12,4) NOT NULL,
    "total_price" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_position_id_fkey"
    FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Feature 5: Inquiry templates
CREATE TABLE "inquiry_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trade" TEXT,
    "subject" TEXT NOT NULL,
    "body_html" TEXT NOT NULL,
    "attachment_path" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inquiry_templates_tenant_id_trade_idx" ON "inquiry_templates"("tenant_id", "trade");

-- Feature 8: Anonymous benchmark entries
CREATE TABLE "benchmark_entries" (
    "id" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "position_text_hash" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unit_price_min" DECIMAL(12,4) NOT NULL,
    "unit_price_p25" DECIMAL(12,4) NOT NULL,
    "unit_price_med" DECIMAL(12,4) NOT NULL,
    "unit_price_p75" DECIMAL(12,4) NOT NULL,
    "unit_price_max" DECIMAL(12,4) NOT NULL,
    "sample_count" INTEGER NOT NULL,
    "region" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benchmark_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "benchmark_entries_trade_position_text_hash_unit_key"
    ON "benchmark_entries"("trade", "position_text_hash", "unit");
CREATE INDEX "benchmark_entries_trade_unit_idx" ON "benchmark_entries"("trade", "unit");
