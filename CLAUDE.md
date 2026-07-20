# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DRYP is a fashion e-commerce monorepo with three components:
- **frontend**: React Native/Expo mobile app (customers + vendors)
- **backend**: Node.js/Express REST API + MongoDB + Agenda jobs
- **website**: Next.js 16 marketing site and vendor admin dashboard

## Development Commands

### Backend (`/backend`)
```bash
cd backend
npm run dev                # nodemon --watch server.js
npm start                  # production (node server.js)
npm run seed               # seed DB with sample products
npm run seed:admin         # seed an admin user
npm run embed              # generate OpenAI embeddings for all products
npm run create-index       # create MongoDB Atlas vector search index
npm run lint               # eslint .
npm test                   # 4 unit tests (node, no framework): studioAccess, uploadValidation, shipWebsiteStudio, googleRegistrationDraft
npm run test:live          # live smoke tests against running server (node tests/api.test.js)
npm run test:integration:google-registration  # integration test with real MongoDB
npm run audit:vendor-google-identities  # audit Google identity integrity
```

### Frontend (`/frontend`)
```bash
cd frontend
npx expo start             # Metro bundler
npx expo run:android       # build + run on Android
npx expo run:ios           # build + run on iOS
npx expo start --web       # web preview
npm run typecheck          # tsc --noEmit
npm run lint               # eslint .
```

### Website (`/website`)
```bash
cd website
npm run dev                # Next.js dev server (localhost:3000)
npm run build              # Next.js production build
npm run lint               # eslint .
```

No dedicated test runner is configured for the website (Playwright is installed but not wired up).

## Architecture

### Backend — Dual-Token Auth & Guest Identity

The `identifyUser` middleware (`src/middleware/auth.js`) is a **3-tier token resolver**:

1. **Supabase JWT** (primary) — calls `supabase.auth.getUser(token)` with the admin service-role key. Auto-creates a local `User` document if none exists yet (linking by `supabaseId`).
2. **Legacy DRYP JWT** (fallback) — verifies against `JWT_SECRET`, loads user by decoded `id`. Supports tokens minted before the Supabase migration.
3. **Suspension check** — if `req.user.isActive === false`, returns 403 regardless of which path succeeded.

Two middleware exports: `identifyUser` (soft auth — sets `req.user` or `null`, always calls `next()`) and `protect` (blocks with 401 if no user).

**Guest identity** is tracked via the `x-guest-id` header. Likes, wishlist, cart, orders, and stylist conversations all work without authentication. On login/register, `mergeGuestData` bulk-migrates guest likes, wishlist items, and cart/orders to the new user account, deduplicating against existing user data. Cart and Order models are mutually exclusive (`user` xor `guestId`).

### Backend — Shopify Integration (3-layer)

**Layer 1: OAuth** (`src/routes/shopifyAuth.js` + `src/utils/shopifyOAuth.js`) — Standard Shopify OAuth 2.0 with HMAC signature verification. Access tokens are **AES-256-GCM encrypted** before saving to MongoDB (`src/utils/crypto.js`, key from `SHOPIFY_TOKEN_ENCRYPTION_KEY`). On success, immediately dispatches an Agenda import job.

**Layer 2: Bulk Import Pipeline** (`src/jobs/shopifyImport.js`) — Three sequential Agenda jobs: `start` (fires Shopify Bulk Operation GraphQL) → `poll` (checks every 15s) → `process` (streams JSONL result line-by-line, reassembles parent/child products via `__parentId`, bulk upserts). Uses `Readable.fromWeb` + `readline` to avoid buffering large catalogs.

**Layer 3: Product Scraping** (`src/routes/products.js` → `shopify-scrape`) — 4-tier fallback detection for single-product imports: `/products.json` → `/meta.json` → HTML fingerprint → JSON-LD/OG meta. Guards against Shopify's soft redirect (dead handles returning HTTP 200 with a different product).

Vendor `shopify.importStatus` is a 5-state machine: `not_connected` → `pending` → `importing` → `completed` / `failed`. Products upsert by `{ vendor, externalId }` so re-imports update in place.

### Backend — Catalog Import

Excel/CSV import (`src/utils/catalogImport.js`) is a 5-phase pipeline: schema discovery (50+ header aliases) → AI-enhanced column mapping (calls OpenAI `gpt-4o-mini`) → streaming row-by-row parse → product grouping by name → bulk `updateOne` upserts in batches of 100. Two-phase commit: preview first, then confirm.

### Backend — Data Models

`User` is the central identity. All other models reference `User._id` (not `Vendor._id`). Vendor is an extension profile (`Vendor.owner` → `User`). Product references `vendor: User._id`. Compound unique index `{ vendor, externalId }` (sparse) prevents duplicate Shopify imports.

Product variants use `options` (e.g., `{ "Color": "Red", "Size": "M" }`) as a Map on each variant, with schema-level uniqueness validation.

### Frontend — State Management

Zustand stores under `src/state/`:
- **auth.ts** — Guest mode via `AsyncStorage` guest_id. Auth actions use **lazy `require()`** to avoid circular deps with `api.ts`. Persistence uses manual AsyncStorage (not Zustand `persist` middleware). On login, resets wishlist and fetches from backend.
- **wishlist.ts** — Optimistic updates, synced from backend after login. Not persisted by Zustand middleware (synced from API).
- **cart.ts** — Persisted via `zustand/persist` + AsyncStorage. Composite IDs (`generateCartId`) for variant uniqueness. Optimistic local updates with backend sync.
- **theme.ts, settings.ts, cache.ts** — Persisted via Zustand `persist` middleware.

### Frontend — API Client

`src/lib/api.ts` is a single `apiCall()` wrapper. Injects `Authorization: Bearer` by reading the token synchronously from `useAuthStore.getState()` (avoids React re-renders). Skips Content-Type/stringification for FormData bodies. Does **not throw** — returns `{ message: ... }` objects for errors; callers check `.token` or `.message` properties.

### Frontend — Navigation & Routing

`expo-router` file-based routing. Root `_layout.tsx` has an auth guard that routes: vendor → `(vendor-tabs)/products`, authenticated with prefs → `(tabs)/home`, authenticated without prefs → `/onboarding`, guest → `/login`. `useCustomRouter` wraps `expo-router`'s `useRouter()` with a history stack (max 10) for controlled back-navigation.

### Frontend — Recommender

Fully client-side in `src/lib/recommender.ts`. 5-dimensional profile vectors (`tag`, `category`, `brand`, `color`, `priceTier`) persisted to AsyncStorage. Exponential decay with 30-minute half-life. `rankItems` splits candidates into top-K (80%) and tail (20%), injecting ~15% random items from tail for exploration.

### Website — Auth

`src/contexts/AuthContext.tsx` is a client-side-only React Context. Token + user stored in **plain `localStorage`** (no SecureStore). Separate session from the mobile app — the website has no Shopify OAuth flow; Shopify integration uses URL-paste scraping instead.

### Website — Styling

Tailwind CSS v4 (CSS-first config via `@tailwindcss/postcss`). Editorial design system: warm off-white background (`#FCFCFA`), near-black text, heavy use of small uppercase tracking (`text-[9px] tracking-[0.3em]`). Two Google Fonts injected via inline `<style>` tags per page: Playfair Display (`.font-editorial`) and Pinyon Script (`.font-cursive`). `react-image-crop` for 3:4 portrait product image cropping.

### Shared Patterns

- **Optimistic UI** — Cart and wishlist update local state before hitting the API, with rollback on failure.
- **S3 presigned uploads** — Backend mints presigned POSTs, frontend/website uploads directly to S3. Backend signs/resolves URLs via `/api/media`.
- **Role-based access** — Checked per-route (no centralized RBAC middleware). Vendor/admin routes inline `if (req.user.role !== 'vendor') return 403`.
- **No standardized error envelope** — Responses are raw data objects. Error handling varies: some routes use `next(error)`, others early-return. The global error handler returns `{ message, status }`.

## Environment Variables

The backend `.env` requires ~20 variables (see the existing Environment Setup section). The backend currently runs on **port 8081** (not 8080 as the root README suggests).
