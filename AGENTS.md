# AGENTS.md

## Port mismatch — the #1 gotcha

The backend defaults to **8080** (`server.js:124`) but almost everything else assumes **5000**:
- `frontend/src/lib/api.ts:4` — hardcoded fallback `http://192.168.1.9:5000`
- `website/next.config.ts:47` — dev proxy targets `localhost:5000`
- `backend/tests/api.test.js:5` — test script hits `localhost:5000`
- `README.md` — setup instructions say port 5000

When fixing or testing, decide which port is canonical and update all references.

## Monorepo (no workspaces)

Three independent npm packages, each with its own `node_modules/`. No root `package.json` or workspace config. Install and run each separately.

| App | Start command | Port |
|-----|--------------|------|
| `backend/` | `npm run dev` (nodemon) or `npm start` | 8080 |
| `frontend/` | `npx expo start` | Metro bundler |
| `website/` | `npm run dev` | 3000 |

## Backend

**Stack:** Express, MongoDB/Mongoose, JWT auth, Agenda.js scheduler, S3 presigned uploads.

**Entry:** `server.js` — mounts all routes under `/api/*`, rate limiters on auth/signup/shopify endpoints.

**Auth middleware** (`src/middleware/auth.js`):
- `identifyUser` — optional; attaches `req.user` if valid JWT, sets `req.guestId` from `x-guest-id` header. Never rejects.
- `protect` — wraps `identifyUser`; returns 401 if no user.

**Product model** (`src/models/Product.js`):
- Supports both simple products (sku + stock) and variants (options array + variants array with option maps).
- Unique index `{ vendor, externalId }` with sparse — prevents duplicate Shopify imports.
- `externalId` + `source` fields track provenance (`dryp` | `shopify` | `manual_import`).

**File upload** (`src/routes/upload.js`):
- `POST /api/upload/presign` — vendor-only, presigned S3 POST, 10MB max.
- Allowed types: jpeg, jpg, png, gif, webp.

**Shopify import** (`src/jobs/shopifyImport.js`):
- Three-step Agenda.js chain: `start-bulk-import` → `poll-bulk-operation` (every 15s) → `process-bulk-result`.
- Streams Shopify bulk JSONL results line-by-line (doesn't buffer entire file).
- Access tokens stored encrypted in Vendor model; decrypted at runtime.

**Seed data:** `seed.js` — hardcoded vendor user ID `69d511c49d3f5ecfb115378a`.

**Tests:** `npm test` runs `tests/api.test.js` — a live-server integration script (not a test framework). Requires the backend to be running.

## Frontend

**Stack:** React Native/Expo SDK 54, expo-router (file-based), Zustand, NativeWind (Tailwind), AsyncStorage.

**Routing** (`app/` directory):
- `(tabs)/` — user tabs: home, search, cart, wishlist, profile
- `(vendor-tabs)/` — vendor tabs: products, orders, analytics, store
- `(checkout)/` — checkout flow
- `admin/` — admin screens
- `_layout.tsx` — root layout handles auth-based redirect logic

**Auth routing** (`app/_layout.tsx:55-73`):
- Authenticated vendor → `/(vendor-tabs)/products`
- Authenticated user with preferences → `/(tabs)/home`
- Authenticated user without preferences → `/onboarding`
- Guest → `/(tabs)/home`
- Neither → `/login`

**API client** (`src/lib/api.ts`):
- All API calls go through `apiCall()`. Adds JWT token or `x-guest-id` header automatically.
- Base URL from `EXPO_PUBLIC_API_BASE_URL` env var.

**Circular dependency workaround:** Stores (`auth.ts`, `wishlist.ts`) use lazy `require('../lib/api')` inside actions instead of top-level imports.

**Guest mode:** Users without accounts get a generated `guest_id` stored in AsyncStorage. Backend reads it from `x-guest-id` header.

**Fonts:** Zaloga (custom, loaded from `assets/fonts/`), Josefin Sans, Cormorant Garamond. Loaded in root layout before splash screen hides.

**Path alias:** `@/*` maps to `src/*` (`tsconfig.json`).

**TypeScript:** `strict: false`. Typecheck with `npm run typecheck`.

## Website

**Stack:** Next.js 16, React 19, Tailwind CSS 4, React Compiler enabled.

**Auth:** React Context + `localStorage` (separate session from mobile app).

**API proxy** (`next.config.ts`): Rewrites `/api/*` to backend. In dev: `localhost:5000` (port mismatch — see above). In production: uses `NEXT_PUBLIC_API_BASE_URL`.

**Build quirk:** `typescript.ignoreBuildErrors: true` in `next.config.ts`.

**Key routes:** `/login`, `/signup`, `/apply` (vendor application), `/dashboard/*` (admin/vendor), `/oauth` (Shopify callback).

## Styling conventions

- Header style (expo-router screens): white bg, no shadow, `Zaloga` font at 28px, `#1a1a1a` tint.
- NativeWind theme tokens defined in `frontend/tailwind.config.js` (light/dark semantic colors).
- Website uses Inter (sans) + Zaloga (display) via `next/font`.

## Environment variables

**Backend** (`.env`):
- `MONGO_URI` — MongoDB connection string
- `JWT_SECRET` — JWT signing key
- `AWS_REGION`, `AWS_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — S3 uploads
- `AWS_S3_PUBLIC_URL` — optional CDN URL for images
- `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET` — Shopify OAuth

**Frontend** (`.env`):
- `EXPO_PUBLIC_API_BASE_URL` — backend URL (use LAN IP for mobile testing, not localhost)
