# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project Overview

CraftMen Plattform is a multi-tenant SaaS platform for the gardening/landscaping industry. Core workflow: upload a PDF specification (Leistungsverzeichnis) → extract line items → send inquiries to suppliers → compare offers → award project. Includes a Python FastAPI microservice for PDF extraction and Microsoft Graph integration for reading emails.

## Commands

```bash
npm run dev          # Start dev server on http://localhost:3000
npm run build        # Production build
npm run lint         # ESLint (no auto-fix)
npm run test:e2e     # Smoke tests (starts dev server, checks basic routes)
npx prisma migrate dev --name <name>   # Create and apply migration
npx prisma studio                      # Database admin UI
docker-compose up                      # Start Python PDF service on :8000
```

`postinstall` automatically runs `prisma generate` after `npm install`.

## Architecture

### Tech Stack

- **Next.js 16.2.6** (App Router) + **React 19** + **TypeScript 5** strict
- **Supabase** (auth + PostgreSQL) with **Prisma 7** ORM and `@prisma/adapter-pg` for connection pooling
- **Tailwind CSS 4** + **Radix UI** primitives + `cn()` from `src/lib/utils/cn.ts`
- **react-hook-form** + **Zod** for forms/validation
- **ExcelJS** for price comparison spreadsheet generation
- Python FastAPI service at `services/pdf-service/`

### Multi-Tenancy

Every database query must be filtered by `tenantId`. The `requireTenant()` utility in `src/lib/utils/tenant.ts` validates the session, retrieves the tenant, and is the required first call in every API route.

### Authentication Flow

- Supabase Auth with SSR cookies via `@supabase/ssr`
- `src/proxy.ts` (middleware): redirects unauthenticated requests to `/login`
- Server client: `src/lib/supabase/server.ts`; browser client: `src/lib/supabase/client.ts`
- Microsoft Graph OAuth for email integration (`/api/auth/microsoft-callback`)

### API Route Pattern

```ts
export async function GET(req: NextRequest) {
  const { tenant, user } = await requireTenant()  // auth + tenantId
  // Zod validation → Prisma query filtered by tenantId → return ApiResponse
}
```

All routes live under `src/app/api/`. Key groups: `auth`, `projects`, `inquiries`, `offers`, `suppliers`, `positions`, `pdf-extract`, `email-scanner`, `export`.

### Database Schema (Prisma)

Key models and their relations:
- `Tenant` → `User` (roles: OWNER/ADMIN/MEMBER/VIEWER), `Project`, `Supplier`
- `Project` (status: DRAFT→ACTIVE→AWAITING_OFFERS→COMPARING→AWARDED→COMPLETED) → `Leistungsverzeichnis`, `Inquiry`
- `Leistungsverzeichnis` (extraction status: PENDING/PROCESSING/COMPLETED/FAILED) → `Position` (extracted line items)
- `Inquiry` (status: DRAFT→SENT→OPENED→OFFER_RECEIVED) unique by `(projectId, supplierId)` → `Offer` → `OfferItem`
- `EmailConnection`: Microsoft Graph OAuth tokens per tenant
- Supplier portal access: `Inquiry.portalToken` (UUID) enables unauthenticated offer submission at `/portal/[token]`

### Route Structure

```
src/app/
  (auth)/          # /login, /register, /forgot-password
  (dashboard)/     # Protected routes — projects list, detail, LV, inquiries, preisspiegel, suppliers, settings
  portal/[token]/  # Unauthenticated supplier offer submission
  api/             # All API routes
```

### Key Files

| File | Purpose |
|------|---------|
| `src/proxy.ts` | Auth middleware |
| `src/lib/utils/tenant.ts` | `requireTenant()` |
| `src/lib/prisma/client.ts` | Prisma singleton with PgAdapter |
| `src/lib/rate-limit.ts` | Token-bucket rate limiting |
| `src/lib/security.ts` | Timing-safe comparison, OAuth state, SHA256 |
| `src/lib/excel/priceComparison.ts` | Excel export |
| `src/lib/graph/client.ts` | Microsoft Graph client factory |

## Environment Variables

Two database URLs are required (see `.env.example`):
- `DATABASE_URL`: connection pooler port 6543 — used by the app at runtime
- `DIRECT_URL`: direct connection port 5432 — used by Prisma migrations only

Other required vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PDF_SERVICE_URL`, `PDF_SERVICE_SECRET`, `MICROSOFT_CLIENT_ID/SECRET/TENANT_ID`.
