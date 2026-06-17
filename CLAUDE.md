# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Note: the parent directory's `../CLAUDE.md` / `../AGENTS.md` describe an unrelated
> "verifiers" Python repo and do **not** apply here. Follow this file for DRYP-store.

## What this is

DRYP ("DR-YP") is a mobile-first fashion e-commerce platform. It's a npm-per-package
monorepo (no workspace tooling) with three independently-installed apps:

- `backend/`  — Node.js + Express + MongoDB (Mongoose) REST API. Deployed on **AWS**.
- `frontend/` — React Native + Expo (expo-router) mobile app for shoppers & vendors. Android is shipped; **iOS is in progress**.
- `website/`  — Next.js 16 (App Router) vendor portal + admin console + marketing landing. Deployed on **Vercel**.

All three are separate npm projects — run `npm install` inside each directory.

## Commands

Run these from within each package directory.

**backend/**
- `npm run dev` — start API with nodemon (auto-reload)
- `npm start` — start API (`node server.js`)
- `npm test` — runs `tests/api.test.js`, an **integration** script that hits a live server over HTTP. It is **not** a unit-test runner: the server must already be running, and the test's `API_BASE_URL` is hardcoded to `http://localhost:5000` while the server now defaults to **8080** — reconcile the port before relying on it.
- `npm run lint` — eslint
- `node seed.js` — seed products into MongoDB (edit the hardcoded `VENDOR_USER_ID` at the top first)
- `node monitor-db.js` — ad-hoc DB connection/health check

**frontend/** (Expo)
- `npm start` / `npx expo start` — Metro bundler; scan QR with Expo Go
- `npm run ios` / `npm run android` / `npm run web`
- `npm run typecheck` — `tsc --noEmit` (the only real "test" gate here)
- `npm run lint` — eslint
- EAS build/submit is configured in `eas.json` (profiles: development, preview, production)

**website/** (Next.js)
- `npm run dev` — dev server on `:3000`
- `npm run build` / `npm start`
- `npm run lint`
- Note: `next.config.ts` sets `typescript.ignoreBuildErrors: true`, so `tsc` errors will NOT fail the build — typecheck manually.

## Environment variables

- **backend** `.env`: `MONGO_URI`, `JWT_SECRET`, `PORT` (defaults 8080), `NEXT_PUBLIC_FRONTEND_URL` (used to build password-reset / vendor-approval links), plus SMTP creds for `src/utils/sendEmail.js`.
- **frontend** `.env`: `EXPO_PUBLIC_API_BASE_URL` — base URL of the backend. Falls back to a hardcoded LAN IP `http://192.168.1.9:5000` in both `src/lib/api.ts` and `src/utils/productMapping.js`. Use a LAN IP or tunnel, never `localhost`, when testing on a device.
- **website** `.env`: `NEXT_PUBLIC_API_BASE_URL`. Locally, `next.config.ts` also proxies `/api/*` and `/uploads/*` to `http://localhost:8080` via rewrites.

⚠️ Port drift: the backend now listens on **8080** (`server.js`, `Dockerfile`, `next.config.ts`), but several fallback URLs and the backend test still reference the old **5000**. When something can't reach the API, check the port first.

## Architecture

### Backend (`backend/src/`)
`server.js` wires Mongoose (`config/database.js`), CORS (origin `*`, allows `x-guest-id`), rate limiters on auth/vendor-signup, request logging, static serving of `public/`, then mounts route modules under `/api/*`. The server **still boots if MongoDB is unreachable** (it logs a warning) — a "works but every query 500s" failure mode.

- **Models** (`models/`): `User` (embeds `addresses`, `paymentMethods`, `preferences`, `likedProducts`; `role: user|vendor|admin`), `Product` (variant/option matrix — `options` define axes, `variants` carry per-combination `stock`/`price`/`sku`), `Vendor` (1:1 with a `role:'vendor'` User via `owner`), `VendorApplication` (waitlist gate), `Cart`, `Order`, `Like`, `WishlistItem`.
- **Auth** (`middleware/auth.js`): two layers. `identifyUser` is **permissive** — it decodes the JWT if present and sets `req.user`, but on *any* failure (bad/expired/missing token) it silently falls back to guest (`req.user = null`) and reads a guest identity from the `x-guest-id` header or `req.body.guestId`. `protect` wraps `identifyUser` and 401s when there's no authenticated user. Guest-capable routes (cart, orders, likes, wishlist) use `identifyUser`; vendor/admin routes use `protect` + an in-handler `req.user.role` check (there is **no** dedicated role middleware — role checks are copy-pasted into each handler).
- **Guest → user merge**: `routes/auth.js#mergeGuestData` migrates a guest's likes/wishlist/cart-orders onto the real account on register/login, keyed by `guestId`. The whole guest model hinges on the client persisting and resending `guestId`.
- **Products**: `GET /api/products` filters by `brand,category,color,search,vendor,minPrice,maxPrice` (comma-separated multi-values, `limit(50)`). Deletes are **soft** (`isActive=false`) and cascade-detach the product from carts/wishlists/likes. There are also derived-list endpoints (`/brands`, `/categories`, `/colors`, `/tags`, `/suggestions`) the frontend filter UI depends on. ⚠️ Express matches in order: literal routes like `/brands` are declared **before** `/:id`, so new literal product routes must go above the `/:id` handler.
- `utils/productMapping.js` is a **legacy** hardcoded string-id → ObjectId table (`casual_1` → `507f...`). The live app uses real Mongo ObjectIds; treat this as dead/seed-era code, not the source of truth.

### Frontend (`frontend/`)
Expo Router file-based routing. Route groups: `app/(tabs)/` (shopper), `app/(vendor-tabs)/` (vendor dashboard), `app/(checkout)/`, `app/account/`, `app/admin/`. `App.tsx`/`expo-entry.js` are thin; `app/_layout.tsx` is the real root.

- **Two competing entry redirects** (a known footgun): `app/_layout.tsx` routes by auth state (`useAuthStore`: vendor → vendor-tabs, onboarded user → home, else onboarding/login), while `app/index.tsx` *separately* redirects based only on an AsyncStorage `categories:selected` key. They can disagree — when fixing navigation/onboarding, reconcile both.
- **State**: Zustand stores in `src/state/` (`auth`, `cart`, `wishlist`, `interactions`, `toast`, `cache`, `settings`, `theme`, `navigation`). Persistence is via AsyncStorage. `auth.ts` deliberately **lazy-`require`s** `lib/api.ts` to break a circular import (`api` reads `useAuthStore.getState()` for the token) — preserve that pattern.
- **API layer** (`src/lib/api.ts`): single `apiCall(endpoint, options)` wrapper. It injects `Authorization: Bearer <token>` or `x-guest-id`, special-cases `FormData` (no JSON content-type), and — importantly — **never throws**: on HTTP error or network failure it returns the parsed error body (often `{ message }`). Callers must check the shape of the response, not try/catch. Verbose `console.log` of every call is intentional debug scaffolding.
- **Product shape mismatch**: the backend returns rich `Product` docs; the UI consumes a flatter `Item` type. `src/utils/productMapping.js` (`mapProductToItem`/`mapProductsToItems`) bridges them and derives `priceTier` from price. `src/hooks/useHomeScreenData.ts` is the canonical fetch+map+dedupe path for the home feed and filter options.
- **Recommender** (`src/lib/recommender.ts`): on-device weighted/decayed preference model (view/like/cart/purchase events, exploration injection). ⚠️ It references a global `ITEMS` in `getInitialItems`/the fallback that is **never imported** — this is a latent ReferenceError if those paths execute. The live feed comes from the API via `useHomeScreenData`, not this function.
- Styling: NativeWind (Tailwind) is configured but most components use `StyleSheet`. Custom fonts (Josefin Sans, Cormorant Garamond, local `Zaloga.ttf`) load in `_layout.tsx` and gate the splash screen.

### Website (`website/src/`)
Next.js App Router. Auth is **client-side only** (`contexts/AuthContext.tsx` stores token+user in `localStorage`, no middleware/SSR guard). Areas: `/` landing, `/login`+`/signup`+`/forgot-password`+`/reset-password/[token]` (these hit **`/api/vendors/*`**, which rejects non-vendor accounts), `/dashboard/*` (vendor: products, store, analytics — talks to `/api/products?vendor=…`, `/api/vendors/me`, `/api/analytics/*`), and `/admin/*` (review `VendorApplication`s, suspend studios). Vendor onboarding is gated: apply → admin approves → email → vendor can register.

## Cross-cutting conventions & gotchas

- **The same backend serves all three clients.** A change to a model or `/api` contract can break the mobile app, the vendor portal, and the admin console at once — grep all three before changing response shapes.
- **Vendor identity is two-headed**: there's a `User` with `role:'vendor'` **and** a separate `Vendor` document linked by `owner`. `Product.vendor` references the **User** `_id`, but `routes/vendors.js#GET /me/products` queries `Product.find({ vendor: vendor._id })` using the **Vendor** `_id` — these id spaces don't always line up; verify which id a query expects.
- **Image uploads** go to backend local disk (`backend/public/uploads/` via `routes/upload.js`, multer, vendor-only, 10MB, jpg/png/gif). On ephemeral AWS hosts this is **not durable** across deploys/restarts — flag if persistence matters.
- **iOS work**: `app.json` defines an Android `package` (`com.dryp.app`) but **no `ios.bundleIdentifier`** — that must be added before an iOS build/submit. EAS project id and `owner` are already set. The app code is largely platform-agnostic; `app/index.tsx` has Android-specific timing branches to audit when bringing up iOS.
- This is a student/early-stage project: expect inconsistent style, commented-out code kept "just in case", emoji-heavy logs, and duplicated logic. Match the surrounding file's conventions rather than imposing a global style.

## What this repo now has (current state)

Phases 0-11 of the roadmap are complete. Run `git log --oneline` for the full list.

### Tests (run from `backend/`)
- `tests/phase*.test.js` — 28 integration suites (one per phase). Run with `node tests/phaseN-name.test.js`. They're isolated: each spins up an in-memory MongoDB, mounts the route, hits it over HTTP. No external services required.
- The legacy `tests/api.test.js` hits a live server and is hard-coded to port 5000 — **don't trust it without updating `API_BASE_URL` first**. Prefer the phase tests.
- `tests/smoke-integration.test.js` — end-to-end smoke test for the happy path.

### Mobile app conventions
- `src/lib/api.ts` exports `apiCall(endpoint, options)`. It is the ONLY way to call the backend; never use `fetch` directly. It injects auth, never throws (returns the error body), and (since phase 7) bounces to /login on 401.
- `src/state/` — Zustand stores. Persist via AsyncStorage. New stores follow the `useFooStore()` pattern.
- `src/hooks/usePushNotifications.ts` — opt-in Expo push registration. Mount once near the root.
- `src/lib/haptics.ts` — shim over `expo-haptics` with a Vibration fallback. Use it on every primary action (like, cart, checkout) — iOS users notice when it's missing.
- `src/components/common/RefreshableScrollView.tsx` — wrap any scrollable list that has a "reload" action.
- The product detail screen reads `useLocalSearchParams().id` and expects an ObjectId. The legacy `productMapping.js` mapping is **dead code** (phase 5.6 removed its callers).
- `app.json` is now canonical. iOS bundle id is `com.dryp.app`, build number 1. Run `npm run check:ios:launch` before submitting to App Store Connect.
- The Recommender (`src/lib/recommender.ts`) had a latent ReferenceError in `getInitialItems` (referenced a global `ITEMS` that was never imported). The dead path is removed; the live feed comes from the API via `useHomeScreenData`.

### Backend conventions
- All requests go through `middleware/auth.js` (`identifyUser` for guest-aware, `protect` for protected). Role checks use the `requireVendor` / `requireAdmin` middleware in `middleware/requireRole.js` — do not copy-paste role checks into handlers.
- Inputs are validated with zod schemas in `validation/schemas.js` via the `validate({ body, params, query })` wrapper. Use it on every new route.
- Sensitive values (Shopify tokens, future API keys) are AES-256-GCM-encrypted at rest with `utils/shopifyCrypto.js`. The encryption key is `SHOPIFY_TOKEN_ENCRYPTION_KEY`; without it the helper logs a warning and stores plaintext (dev-only).
- Email goes out via Resend (`utils/sendEmail.js`) gated by `requireEmailConfig` (no key → 503, never silent failure).
- Rate limiters live in `server.js`: `authLimiter` on login/register, `vendorSignupLimiter` on vendor register, `productsLimiter` on `/api/products/*`, `cartLimiter` on `/api/cart/*`, `likesLimiter` on `/api/likes/*`, `wishlistLimiter` on `/api/wishlist/*`. Adjust here.
- The trending endpoint is `GET /api/products/trending` — declared **before** `/:id` so Express doesn't parse the literal as a product id. Same ordering rule applies to any new literal route.
- Admin metrics live at `GET /api/analytics/admin/metrics` (admin only, 30-day revenue series + counts + top vendors).

### Common gotchas
- `Product.vendor` is the **User** `_id` (a `vendor` user), not the `Vendor` doc's `_id`. `Vendor.owner` is the same User id. Joining `Order.items.vendor` (User id) → `Vendor` uses `Vendor.owner`. Don't confuse the two.
- The `Order.items.vendor` field is a User id. `Order.totalAmount` is the field; there's no `total` or `lineTotal` field.
- `User.passwordHash` is the field, not `password`. The auth routes handle bcrypt transparently.
- `User.pushTokens` is a `{ token, platform, appVersion, registeredAt }` array. `sendPush` (utils/pushNotifications.js) cleans up `DeviceNotRegistered` tokens automatically.
- Image uploads still go to `public/uploads/` (ephemeral on AWS) — S3 storage is wired (`utils/storage.js`) but uploads are not migrated.
