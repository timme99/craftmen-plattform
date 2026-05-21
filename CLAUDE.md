# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project Overview

CraftMen Plattform is a multi-tenant SaaS platform for the gardening/landscaping industry. Core workflow: upload a PDF specification (Leistungsverzeichnis) → extract line items → send inquiries to suppliers → compare offers → award project. Includes a Python FastAPI microservice for PDF extraction and Microsoft Graph integration for reading emails.

## Commands

```bash
npm run dev          # Start dev server on http://localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm run test:e2e     # Smoke tests (starts dev server, checks basic routes)
npx prisma migrate dev --name <name>   # Create and apply migration
npx prisma studio                      # Database admin UI
docker-compose up                      # Start Python PDF service on :8000
```

## Architecture

### Tech Stack

- **Next.js 16.2.6** (App Router) + **React 19** + **TypeScript 5** strict
- **Supabase** (auth + PostgreSQL) with **Prisma 7** ORM and `@prisma/adapter-pg` for connection pooling
- **Tailwind CSS 4** + **Radix UI** primitives + `cn()` from `src/lib/utils/cn.ts`
- **react-hook-form** + **Zod** for forms/validation
- **ExcelJS** for price comparison spreadsheet generation
- Python FastAPI service at `services/pdf-service/`
- TypeScript path alias: `@/*` → `src/*` (use `@/lib/...` not relative paths)

### Multi-Tenancy

Every database query must be filtered by `tenantId`. The `requireTenant()` utility in `src/lib/utils/tenant.ts` validates the session and returns a Prisma `User` with the `tenant` relation included (`dbUser.tenant`, `dbUser.tenantId`). It throws or redirects on failure — never returns null.

### Authentication Flow

- Supabase Auth with SSR cookies via `@supabase/ssr`
- `src/proxy.ts`: contains the auth middleware logic (cookie refresh + session check), but **no `src/middleware.ts` currently wires it up** — routes are not protected by middleware at this time
- Server client: `src/lib/supabase/server.ts`; browser client: `src/lib/supabase/client.ts`
- Microsoft Graph OAuth for email integration (`/api/auth/microsoft/callback`)

### API Route Pattern

```ts
export async function GET(req: NextRequest) {
  const dbUser = await requireTenant()  // redirects to /login if unauth; throws on DB error
  const tenantId = dbUser.tenantId
  // Zod validation → Prisma query filtered by tenantId → return ApiResponse
}
```

All routes live under `src/app/api/`. Key groups: `auth`, `projects`, `inquiries`, `offers`, `suppliers`, `positions`, `pdf-extract`, `email-scanner`, `export`.

### Database Schema (Prisma)

Key models and their relations:
- `Tenant` → `User` (roles: OWNER/ADMIN/MEMBER/VIEWER), `Project`, `Supplier`
- `Project` (status: DRAFT→ACTIVE→AWAITING_OFFERS→COMPARING→AWARDED→COMPLETED→ARCHIVED) → `Leistungsverzeichnis`, `Inquiry`
- `Leistungsverzeichnis` (extraction status: PENDING/PROCESSING/COMPLETED/FAILED) → `Position` (extracted line items)
- `Inquiry` (status: DRAFT→SENT→OPENED→OFFER_RECEIVED→DECLINED→EXPIRED) unique by `(projectId, supplierId)` → `Offer` → `OfferItem`
- `EmailConnection`: Microsoft Graph OAuth tokens per tenant
- `Subscription`: Stripe billing; enforces tenant plan (FREE/STARTER/PROFESSIONAL/ENTERPRISE)
- Supplier portal access: `Inquiry.portalToken` (UUID) enables unauthenticated offer submission at `/portal/[token]`

### Route Structure

```
src/app/
  (auth)/          # /login, /register, /forgot-password
  (dashboard)/     # Protected routes — projects, suppliers, settings
                   # Nested under projects/[id]: Leistungsverzeichnis, inquiries, Preisspiegel (price comparison)
  portal/[token]/  # Unauthenticated supplier offer submission
  api/             # All API routes
```

### Key Files

| File | Purpose |
|------|---------|
| `src/proxy.ts` | Auth middleware logic (not yet wired via middleware.ts) |
| `src/lib/utils/tenant.ts` | `requireTenant()` and `getCurrentTenant()` |
| `src/lib/prisma/client.ts` | Prisma singleton with PgAdapter |
| `src/lib/rate-limit.ts` | Sliding-window rate limiter (20 req/min, in-memory) |
| `src/lib/security.ts` | Timing-safe comparison, OAuth state, SHA256 |
| `src/lib/excel/priceComparison.ts` | Excel export |
| `src/lib/graph/client.ts` | Microsoft Graph client factory |

## Environment Variables

Two database URLs are required (see `.env.example`):
- `DATABASE_URL`: connection pooler port 6543 — used by the app at runtime
- `DIRECT_URL`: direct connection port 5432 — used by Prisma migrations only

Other required vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `PDF_SERVICE_URL`, `PDF_SERVICE_SECRET`, `MICROSOFT_CLIENT_ID/SECRET/TENANT_ID`.
