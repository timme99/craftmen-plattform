-- ============================================================
-- CraftMen Plattform — Initial Schema Migration
-- Multi-Tenant SaaS für Garten- und Landschaftsbau
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUMS ───────────────────────────────────────────────────────────────────

CREATE TYPE "Plan" AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'AWAITING_OFFERS', 'COMPARING', 'AWARDED', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "InquiryStatus" AS ENUM ('DRAFT', 'SENT', 'OPENED', 'OFFER_RECEIVED', 'DECLINED', 'EXPIRED');
CREATE TYPE "OfferSource" AS ENUM ('PORTAL', 'EMAIL_ATTACHMENT', 'MANUAL');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING');

-- ─── TENANTS ─────────────────────────────────────────────────────────────────

CREATE TABLE tenants (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    plan        "Plan" NOT NULL DEFAULT 'FREE',
    "isActive"  BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── USERS ───────────────────────────────────────────────────────────────────

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "tenantId"    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    "supabaseId"  TEXT NOT NULL UNIQUE,
    email         TEXT NOT NULL,
    "firstName"   TEXT,
    "lastName"    TEXT,
    role          "UserRole" NOT NULL DEFAULT 'MEMBER',
    "isActive"    BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE ("tenantId", email)
);

-- ─── PROJECTS ────────────────────────────────────────────────────────────────

CREATE TABLE projects (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "tenantId"   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    description  TEXT,
    location     TEXT,
    status       "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── LEISTUNGSVERZEICHNISSE ───────────────────────────────────────────────────

CREATE TABLE leistungsverzeichnisse (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "projectId"         UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    "tenantId"          UUID NOT NULL,
    "fileName"          TEXT NOT NULL,
    "storagePath"       TEXT NOT NULL,
    "mimeType"          TEXT NOT NULL DEFAULT 'application/pdf',
    "extractionStatus"  "ExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "extractedAt"       TIMESTAMPTZ,
    "errorMessage"      TEXT,
    "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── POSITIONS ───────────────────────────────────────────────────────────────

CREATE TABLE positions (
    id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "leistungsverzeichnisId" UUID NOT NULL REFERENCES leistungsverzeichnisse(id) ON DELETE CASCADE,
    "positionNumber"         TEXT NOT NULL,
    "shortText"              TEXT NOT NULL,
    "longText"               TEXT,
    unit                     TEXT,
    quantity                 NUMERIC(12, 3),
    trade                    TEXT,
    "sortOrder"              INTEGER NOT NULL DEFAULT 0,
    "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SUPPLIERS ───────────────────────────────────────────────────────────────

CREATE TABLE suppliers (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "tenantId"    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT,
    email         TEXT NOT NULL,
    phone         TEXT,
    address       TEXT,
    trade         TEXT,
    notes         TEXT,
    "isActive"    BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE ("tenantId", email)
);

-- ─── INQUIRIES ───────────────────────────────────────────────────────────────

CREATE TABLE inquiries (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "projectId"      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    "supplierId"     UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    "tenantId"       UUID NOT NULL,
    status           "InquiryStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt"         TIMESTAMPTZ,
    deadline         TIMESTAMPTZ,
    "portalToken"    UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
    "portalOpenedAt" TIMESTAMPTZ,
    "emailMessageId" TEXT,
    notes            TEXT,
    "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE ("projectId", "supplierId")
);

-- ─── OFFERS ──────────────────────────────────────────────────────────────────

CREATE TABLE offers (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "inquiryId"      UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
    "tenantId"       UUID NOT NULL,
    source           "OfferSource" NOT NULL DEFAULT 'PORTAL',
    "totalNet"       NUMERIC(12, 2),
    "totalGross"     NUMERIC(12, 2),
    "vatRate"        NUMERIC(5, 2),
    currency         TEXT NOT NULL DEFAULT 'EUR',
    "validUntil"     TIMESTAMPTZ,
    notes            TEXT,
    "attachmentPath" TEXT,
    "submittedAt"    TIMESTAMPTZ,
    "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── OFFER ITEMS ─────────────────────────────────────────────────────────────

CREATE TABLE offer_items (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "offerId"    UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    "positionId" UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    "unitPrice"  NUMERIC(12, 4),
    "totalPrice" NUMERIC(12, 2),
    notes        TEXT,
    "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE ("offerId", "positionId")
);

-- ─── EMAIL CONNECTIONS ────────────────────────────────────────────────────────

CREATE TABLE email_connections (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "tenantId"       UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    provider         TEXT NOT NULL DEFAULT 'microsoft',
    "accessToken"    TEXT,
    "refreshToken"   TEXT,
    "tokenExpiresAt" TIMESTAMPTZ,
    "emailAddress"   TEXT,
    "isActive"       BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── PRICE COMPARISONS ───────────────────────────────────────────────────────

CREATE TABLE price_comparisons (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "projectId"   UUID NOT NULL UNIQUE,
    "tenantId"    UUID NOT NULL,
    "exportPath"  TEXT,
    "generatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SUBSCRIPTIONS ───────────────────────────────────────────────────────────

CREATE TABLE subscriptions (
    id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "tenantId"             UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    plan                   "Plan" NOT NULL DEFAULT 'FREE',
    status                 "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "stripeCustomerId"     TEXT,
    "stripeSubscriptionId" TEXT,
    "currentPeriodStart"   TIMESTAMPTZ,
    "currentPeriodEnd"     TIMESTAMPTZ,
    "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── AUDIT LOG ───────────────────────────────────────────────────────────────

CREATE TABLE audit_logs (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "tenantId"   UUID NOT NULL,
    "userId"     UUID,
    action       TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId"   UUID NOT NULL,
    metadata     JSONB,
    "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_tenant_entity ON audit_logs ("tenantId", "entityType", "entityId");
CREATE INDEX idx_audit_logs_tenant_created ON audit_logs ("tenantId", "createdAt");
CREATE INDEX idx_projects_tenant ON projects ("tenantId");
CREATE INDEX idx_inquiries_project ON inquiries ("projectId");
CREATE INDEX idx_inquiries_supplier ON inquiries ("supplierId");
CREATE INDEX idx_offers_inquiry ON offers ("inquiryId");
CREATE INDEX idx_positions_lv ON positions ("leistungsverzeichnisId");

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────

ALTER TABLE tenants           ENABLE ROW LEVEL SECURITY;
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE leistungsverzeichnisse ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs        ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's tenant_id
CREATE OR REPLACE FUNCTION get_tenant_id()
RETURNS UUID AS $$
  SELECT "tenantId"
  FROM users
  WHERE "supabaseId" = auth.uid()::TEXT
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- RLS Policies (tenant isolation)
CREATE POLICY tenant_isolation ON projects
  USING ("tenantId" = get_tenant_id());

CREATE POLICY tenant_isolation ON leistungsverzeichnisse
  USING ("tenantId" = get_tenant_id());

CREATE POLICY tenant_isolation ON suppliers
  USING ("tenantId" = get_tenant_id());

CREATE POLICY tenant_isolation ON inquiries
  USING ("tenantId" = get_tenant_id());

CREATE POLICY tenant_isolation ON offers
  USING ("tenantId" = get_tenant_id());

CREATE POLICY tenant_isolation ON email_connections
  USING ("tenantId" = get_tenant_id());

CREATE POLICY tenant_isolation ON audit_logs
  USING ("tenantId" = get_tenant_id());

-- Users can only see their own tenant
CREATE POLICY user_tenant_isolation ON users
  USING ("tenantId" = get_tenant_id());

-- Public portal access for inquiries (by token, no auth needed)
CREATE POLICY portal_token_access ON inquiries
  FOR SELECT USING (TRUE);

CREATE POLICY portal_offer_insert ON offers
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY portal_offer_item_insert ON offer_items
  FOR INSERT WITH CHECK (TRUE);

-- ─── UPDATED_AT TRIGGERS ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['tenants','users','projects','leistungsverzeichnisse','suppliers','inquiries','offers','offer_items','email_connections','subscriptions']
  LOOP
    EXECUTE format('CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', tbl);
  END LOOP;
END;
$$;
