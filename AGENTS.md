# AGENTS.md — DRYP-store

Supplemental guidance for OpenCode agents. See `CLAUDE.md` for project overview, dev commands, and architecture. This file adds what `CLAUDE.md` leaves out.

## Port & URL pitfalls

- Backend runs on **8080** (`server.js` line `const PORT = process.env.PORT || 8080`). The test script (`tests/api.test.js`) and README both incorrectly say 5000 — do not trust them.
- `frontend/src/lib/api.ts` hardcodes a fallback `http://192.168.1.9:5000`. The real env var is `EXPO_PUBLIC_API_BASE_URL`. Set it to `http://<lan-ip>:8080` for physical devices.
- Website `next.config.ts` rewrites `/api/*` using `NEXT_PUBLIC_API_BASE_URL` (both dev and prod). The image `remotePattern` also reads from this env var. Change one env var to bump the backend port; no hardcoded port in config anymore.

## Package structure

- **No root `package.json`** — this is not an npm workspace. Each of `backend/`, `frontend/`, `website/` is independent. `npm install` must be run separately in each.
- Package manager: **npm** (verified by `package-lock.json` in all three dirs, no `yarn.lock` or `pnpm-lock.yaml`).

## Backend gotchas

- **No ESLint config exists** despite `"lint": "eslint ."` in `package.json`. Running `npm run lint` in backend will fail. Create one or skip it.
- **Guest-first architecture**: Almost every model (User, Cart, WishlistItem, Like, Order) supports dual ownership via `user` OR `guestId` fields. Compound unique indexes use `partialFilterExpression` (e.g., `{ user: 1, product: 1 }` with `partialFilterExpression: { user: { $ne: null } }`). The `x-guest-id` header drives guest auth — see `src/middleware/auth.js`.
- **Guest data merged on login**: `auth.js` route calls `mergeGuestData()` to transfer guest cart/wishlist/likes/orders to the authenticated user.
- **Soft-delete products**: `DELETE /api/products/:id` sets `isActive = false`, then cleans up cart, wishlist, and likes references. Not a hard MongoDB delete.
- **Rate limits differ by `NODE_ENV`**: `isProduction ? 5 : 50` style for vendor signup/apply. Development gets much higher tolerances.
- **Rate-limited routes** (express-rate-limit): login & register (10/min), vendor signup (5 prod / 50 dev), vendor apply (5/20), Shopify auth (10/50).
- **Test file (`tests/api.test.js`)** uses `node-fetch` (dynamic ESM import) — no Jest/Mocha. Runs as `node tests/api.test.js` against a live server. Port hardcoded to 5000 (wrong).
- **Mongoose transactions used** in `vendors.js` for vendor registration and admin onboarding (`startSession` + `commitTransaction` + `abortTransaction`).
- **S3 images are stored as keys**, not public URLs. Use `signProductImages()` / `signImageKey()` from `src/utils/imageUrls.js` to generate presigned URLs. The product route already applies this via `signProductImages` on responses.
- **Agenda.js** (`src/config/agenda.js`): `processEvery: '15 seconds'`. Shopify bulk import is a 3-step chain: `shopify:start-bulk-import` → (15s poll) `shopify:poll-bulk-operation` → `shopify:process-bulk-result`. Imported products use `bulkWrite` with upsert on `(vendor, externalId)`.

## Frontend gotchas

- **Zustand stores use lazy `require()` to break circular deps**: `auth.ts` and `wishlist.ts` call `const { apiCall } = require('../lib/api')` inside action functions, not at top level. `cart.ts` is the exception — it uses a top-level import (no circular issue there). Never add a top-level ES import of `api.ts` from `auth.ts` or `wishlist.ts`.
- **`tsconfig.json` has `strict: false`** — types are loose. Don't expect sound type checking.
- **Frontend has no ESLint config** either (same as backend — `"lint": "eslint ."` but no config file).
- **NativeWind v2** (Tailwind CSS) via `nativewind/preset` in `tailwind.config.js`. `global.css` has `@tailwind base; @tailwind components; @tailwind utilities;`.
- **Custom fonts** loaded in `app/_layout.tsx`: JosefinSans (400/500/600), CormorantGaramond 700, Zaloga. Header convention: `fontFamily: 'Zaloga', fontSize: 28`, white bg, `#e0e0e0` 1px bottom border, no shadow.
- **On-device recommender** (`src/lib/recommender.ts`): weighted event types (view=1, like=3, cart=5, purchase=10), 30-min half-life decay, 15% random exploration. Profile vectors stored in AsyncStorage.
- **Route groups** (`(tabs)`, `(vendor-tabs)`, `(checkout)`) do not affect URL paths in expo-router.

## Website gotchas

- **Auth is completely separate** from the mobile app: uses React Context (`AuthContext.tsx`) + `localStorage`, not Zustand + AsyncStorage. The mobile app and website share no auth session.
- **Tailwind CSS v4**: Uses `@tailwindcss/postcss` (the v4 PostCSS plugin), not the traditional `tailwindcss` + `postcss` + `autoprefixer` combo from v3.
- **ESLint v9 flat config**: `eslint.config.mjs` using `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`. Not `.eslintrc` format.
- **TypeScript strict mode**: `tsconfig.json` has `"strict": true` (unlike frontend which is `false`).
- **`ignoreBuildErrors: true`** in `next.config.ts` — Next.js builds will not fail on TS errors during production build.
- **API proxy**: Next.js rewrites in `next.config.ts` send `/api/*` requests to the backend. The website never calls the backend directly from the browser.

## Google OAuth

- **Google OAuth added**: Backend route at `GET /api/auth/google` (consent redirect) and `GET /api/auth/google/callback` (token exchange). Callback page at `/oauth/google/callback` in the website.
- **User model updated** (`backend/src/models/User.js`): `authProvider` enum now includes `"google"`. Google-authed users get `role: 'vendor'` and a Vendor profile created automatically.
- **Google Client ID/Secret** are in `backend/.env` (and `.env.local`, `.env.production`). The redirect URI is `{SHOPIFY_APP_URL}/api/auth/google/callback` — on dev this resolves to `http://localhost:8080/api/auth/google/callback`.
- **Website signup/login buttons**: Both replaced "Continue with Shopify" with "Continue with Google". Shopify connection is only available post-auth in the dashboard's store settings (`/dashboard/store`).

## Env files convention

- Each package has two env templates: `.env.local` (dev) and `.env.production` (production). The active `.env` file is the one actually read by the app.
- `website/.env` had port 5000 hardcoded — it's now fixed to **8080** (reads `NEXT_PUBLIC_API_BASE_URL`).
- `website/next.config.ts` rewrites `/api/*` using `NEXT_PUBLIC_API_BASE_URL` (both dev and prod). The image `remotePattern` also reads from this env var. Change one env var to bump the backend port; no hardcoded port in config anymore.
- Root `.env.local` is **tracked in git** (`.gitignore` has `.env*` at root but `.env.local` was committed before the rule was added). Be careful not to expose its contents.

## Cross-cutting

- **No CI/CD**: No `.github/` directory, no workflow files exist in the repo.
- **`.gitignore` at root**: only ignores `tut.txt`, `work.md`, `.env*`. Each subpackage has its own `.gitignore`.
- **Password validation** (backend `auth.js`): `^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$` — 8+ chars, uppercase, lowercase, digit.
