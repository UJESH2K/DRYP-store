# AGENTS.md — DRYP-store

Supplemental guidance for OpenCode agents. See `CLAUDE.md` for project overview, dev commands, and architecture. This file adds what `CLAUDE.md` leaves out.

## Vendor Google OAuth (website studio)

**Product gate (OpenSpec: `vendor-google-auth-approval`):** Google login succeeds only if:
1. Email has `VendorApplication.status === 'approved'`, **or**
2. User already exists as active `vendor` / `admin`.

Otherwise callback redirects with `error=no_application|application_pending|application_rejected|account_suspended` (no JWT).

**Env (backend):**
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `SHOPIFY_APP_URL` = public API base for Google **redirect_uri**
  - local: `http://localhost:8081` → `…/api/auth/google/callback`
  - prod example: `https://api.dryp.store`
- `NEXT_PUBLIC_FRONTEND_URL` = website after OAuth (`http://localhost:3000` or `https://www.dryp.store`)

**Google Cloud Console** must list exact redirect URI(s) for local and prod.

**Flow:** `/apply` → admin approve → email → `/login` Google → dashboard (Manual / Excel / Shopify).

## Port & URL pitfalls

- Backend port is set by `PORT` in `backend/.env` (currently **8081**). Apache's `PEMHTTPD-x64` service holds port 8080, so the backend uses 8081.
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
- **Google Client ID/Secret** are in `backend/.env` (and `.env.local`, `.env.production`). The redirect URI is `{SHOPIFY_APP_URL}/api/auth/google/callback` — on dev this resolves to `http://localhost:8081/api/auth/google/callback`.
- **Website signup/login buttons**: Both replaced "Continue with Shopify" with "Continue with Google". Shopify connection is only available post-auth in the dashboard's store settings (`/dashboard/store`).

## Env files convention

- Each package has two env templates: `.env.local` (dev) and `.env.production` (production). The active `.env` file is the one actually read by the app.
- `website/.env` had port 5000 hardcoded — it's now fixed to **8081** (reads `NEXT_PUBLIC_API_BASE_URL`).
- `website/next.config.ts` rewrites `/api/*` using `NEXT_PUBLIC_API_BASE_URL` (both dev and prod). The image `remotePattern` also reads from this env var. Change one env var to bump the backend port; no hardcoded port in config anymore.
- Root `.env.local` is **tracked in git** (`.gitignore` has `.env*` at root but `.env.local` was committed before the rule was added). Be careful not to expose its contents.

## AI Chatbot — MongoDB Vector Search

- **New backend route**: `POST /api/ai/chat` at `backend/src/routes/ai.js`. Takes `{ messages: [...], vendorId?: string }`. Embeds the last user message with OpenAI `text-embedding-3-small`, runs `$vectorSearch` against the `product_embeddings` Atlas Search index, generates a GPT-4o-mini response.
- **Embedding generation**: `backend/src/utils/embeddings.js` — `generateEmbedding(text)` and `generateProductEmbedding(product)`.
- **Product model updated** (`backend/src/models/Product.js`): added `embedding: { type: [Number], default: undefined }`.
- **Auto-embedding on product create/update**: `backend/src/routes/products.js` — after `Product.create()` and `Product.findByIdAndUpdate()`, a fire-and-forget `generateProductEmbedding()` call updates the product's embedding.
- **Batch embedding**: `POST /api/ai/embed-products` (admin only) scans products without embeddings and generates them.
- **Fallback text search**: If vector search returns 0 results, falls back to regex `$or` search across name, description, brand, category, tags.
- **Mobile app chat UI**: `frontend/app/ai-chat.tsx` — full chat screen accessible from profile page (/ai-chat). Shows suggestion chips, message bubbles, and inline product cards that link to product detail.
- **Entry point**: Profile screen (`frontend/app/(tabs)/profile.tsx`) — "AI Stylist" row in Support section using `sparkles-outline` icon.
- **Lazy OpenAI client**: Both `embeddings.js` and `ai.js` create the OpenAI client lazily inside functions (not at module level), so the server starts without `OPENAI_API_KEY` being set.
## Shopify Link Scraper

- **New backend route**: `POST /api/products/shopify-scrape` and `POST /api/products/shopify-preview` at `backend/src/routes/products.js`. Takes `{ url }`, scrapes the Shopify product page, and creates a product entry.
- **Scraper utility**: `backend/src/utils/shopifyScraper.js` — extracts data from JSON-LD (`application/ld+json`), Shopify `__INITIAL_STATE__`, or falls back to Open Graph meta tags.
- **Website page**: `website/src/app/dashboard/shopify-scrape/page.tsx` — URL input, preview of scraped data, one-click import.
- **Dashboard redesign**: `website/src/app/dashboard/page.tsx` — three prominent cards (Manual, Excel, Shopify) as the post-auth landing.
- **Backend scraper**: Uses native `fetch` with realistic User-Agent headers. First tries JSON-LD structured data, then Shopify's `__INITIAL_STATE__` script, then basic OG meta tags as fallback.

## Required Atlas Vector Search index
  ```
  Database: dryp-store (or your DB name)
  Collection: products
  Index name: product_embeddings
  Type: vector
  JSON definition:
  {
    "fields": [
      {
        "type": "vector",
        "path": "embedding",
        "numDimensions": 1536,
        "similarity": "cosine"
      }
    ]
  }
  ```
- **OpenAI API key**: Must be set in `backend/.env` as `OPENAI_API_KEY=sk-...`. Required for both embedding generation and chat responses.
- **First-time setup**: After adding the API key + creating the Atlas index, hit `POST /api/ai/embed-products` with an admin token to batch-embed all existing products. After that, new/updated products auto-embed.

## Cross-cutting

- **No CI/CD**: No `.github/` directory, no workflow files exist in the repo.
- **`.gitignore` at root**: only ignores `tut.txt`, `work.md`, `.env*`. Each subpackage has its own `.gitignore`.
- **Password validation** (backend `auth.js`): `^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$` — 8+ chars, uppercase, lowercase, digit.
