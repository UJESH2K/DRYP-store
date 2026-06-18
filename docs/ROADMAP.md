# DRYP Roadmap & Phase-by-Phase TODOs

> Living doc. **Check a box** in your PR description. Don't break the working code
> to add a checkbox. Each task lists **Goal · Files · Verify** so a stranger
> can pick it up cold.

Conventions:
- `🟢 safe` — additive change, no behavior change
- `🟡 risk` — touches shared code, requires a second reviewer
- `🔴 high-risk` — touches data shape or auth, requires `feat/…` branch + manual QA
- One PR per `[ ]`. Don't bundle.
- Branch naming: `phase<N>/<short-slug>` (e.g. `phase0/strip-pii-logs`).

---

## PHASE 0 — Safety nets (≤ 1 day, do today)

> Goal: stop bleeding. No more PII in prod logs, no more "server-up-but-DB-down"
> failure mode, no more surprise peer-dep walls.

- [ ] **P0.1** `🟢` **Strip PII / request bodies from prod logs**
  - **Goal:** `apiCall` and `state/auth.ts` must not log request/response bodies
    in production builds. Today they print passwords on register/login.
  - **Files:** `frontend/src/lib/api.ts`, `frontend/src/state/auth.ts`,
    `frontend/src/lib/recommender.ts` (it logs on init).
  - **Verify:** Build with `EXPO_PUBLIC_API_BASE_URL=…` and `NODE_ENV=production`,
    `npx expo start --no-dev`. Trigger register. Confirm no `Body:` or `📤 Sending data:`
    line in the Metro output. Dev mode (`__DEV__`) should still log.

- [ ] **P0.2** `🟡` **Hard-fail backend on MongoDB connection error**
  - **Goal:** `server.js` currently logs a warning and `app.listen`s anyway.
    If DB is down we want a crash, not silent 500s.
  - **Files:** `backend/server.js` (the `(async () => { … })()` IIFE).
  - **Verify:** `MONGO_URI=garbage npm start` exits non-zero within 5s with a
    clear error. Restore real URI, server starts.

- [ ] **P0.3** `🟢` **Add `.env.example` to all three apps**
  - **Goal:** New devs know which env vars are required.
  - **Files:** new `backend/.env.example`, `frontend/.env.example`,
    `website/.env.example`. List every var from `CLAUDE.md` §Environment variables
    with a one-line comment.
  - **Verify:** `cp .env.example .env`, follow the comments, app boots.

- [ ] **P0.4** `🟢` **Bump Dockerfile to `node:20-alpine`**
  - **Goal:** Match RN 0.81 / Expo SDK 54 toolchain.
  - **Files:** `backend/Dockerfile`.
  - **Verify:** `docker build .` succeeds.

- [ ] **P0.5** `🟢` **CI: `tsc --noEmit` + eslint for frontend and website**
  - **Goal:** Catch type errors and lint regressions on PRs (the website's
    `next.config.ts` ignores TS errors at build time, so manual `tsc` matters).
  - **Files:** new `.github/workflows/ci.yml`. Matrix: `frontend` (`npm run
    typecheck && npm run lint`), `website` (`tsc --noEmit && npm run lint`),
    `backend` (`npm run lint`).
  - **Verify:** Open a PR with an intentional `any` leak in `frontend/`; CI
    fails.

---

## PHASE 1 — iOS ship-blockers (1–2 days, blocks TestFlight)

> Goal: get the iOS app onto TestFlight this week, and on the App Store
> before end of month. No architectural refactor — just unblock.

- [ ] **P1.1** `🟡` **Add iOS config to `app.json`**
  - **Goal:** Set `ios.bundleIdentifier`, `ios.icon`, `ios.splash`, `ios.infoPlist`.
    Bundle id = `com.dryp.app` (match Android).
  - **Files:** `frontend/app.json` OR migrate to `frontend/app.config.ts`
    (preferred for env-driven iOS config).
  - **Verify:** `npx expo prebuild --platform ios --no-install` succeeds;
    generated `ios/Runner/Info.plist` has the bundle id and ATS exceptions.

- [ ] **P1.2** `🟡` **Add ATS exception for backend HTTP (dev only)**
  - **Goal:** iOS refuses HTTP by default. `http://192.168.1.9:5000` and your
    AWS HTTP endpoint will be blocked.
  - **Files:** `frontend/app.config.ts` → `ios.infoPlist.NSAppTransportSecurity`.
    Add `NSAllowsArbitraryLoads: true` for **development** only. In production
    this is a no-op because the backend is HTTPS.
  - **Verify:** `eas build --profile development --platform ios`. Install
    on a real device, app talks to backend, login works.

- [ ] **P1.3** `🟡` **Add privacy manifest (`PrivacyInfo.xcprivacy`)**
  - **Goal:** Apple requires it for new submissions since May 2024.
  - **Files:** `frontend/app.json` plugins → `expo-build-properties` config,
    OR hand-write a `PrivacyInfo.xcprivacy` and reference it in `app.config.ts`.
  - **Verify:** `eas build --profile development --platform ios`, look for
    `PrivacyInfo.xcprivacy` in the built `.app` bundle.

- [ ] **P1.4** `🟢` **App icon set (1024×1024) + splash + adaptive icon**
  - **Goal:** Single 1024×1024 PNG, no alpha. Use `npx expo-icon` or Figma.
  - **Files:** `frontend/assets/icon.png`, `frontend/assets/splash.png`,
    `frontend/assets/adaptive-icon.png` (Android), and `frontend/assets/ios/`
    (or just one icon — Expo resizes).
  - **Verify:** Visual check on iOS simulator / dev client. White-on-white
    icons are the most common App Store rejection — sanity check.

- [ ] **P1.5** `🟡` **First EAS dev build for iOS**
  - **Goal:** A working iOS dev client on a real device.
  - **Commands:**
    ```bash
    npm install -g eas-cli
    eas login
    eas build --profile development --platform ios
    ```
  - **Verify:** `eas build` returns an `.ipa` URL. Install via the QR/email
    link on a real iPhone. App opens and shows the splash + auth screen.

- [ ] **P1.6** `🟡` **Point `EXPO_PUBLIC_API_BASE_URL` at the AWS backend**
  - **Goal:** The dev client must hit the real backend, not your LAN IP.
  - **Files:** EAS Secrets, or pass via `eas.json` `env` per build profile.
  - **Verify:** Login from the iOS dev client works against the AWS backend.

- [ ] **P1.7** `🟢` **TestFlight internal beta**
  - **Goal:** Get 1–2 internal testers. Apple requires a real-device TestFlight
    pass before App Store review.
  - **Commands:**
    ```bash
    eas build --profile preview --platform ios
    eas submit --platform ios --latest
    ```
  - **Verify:** TestFlight invite works, app launches on tester's device,
    they can sign up / log in.

- [ ] **P1.8** `🟢` **App Store Connect metadata**
  - **Goal:** Screenshots (6.5", 5.5" iPhone, 12.9" iPad), description,
    keywords, support URL, privacy policy URL, App Privacy questionnaire.
  - **Verify:** App Store Connect → My Apps → DRYP → 1.0 submit-ready.

- [ ] **P1.9** `🟡` **App Review submission**
  - **Goal:** Submit build. Be ready for 1–3 days of review, then likely
    a metadata rejection you'll need to fix and resubmit.
  - **Verify:** Status `Waiting for Review` → `In Review` → `Ready for Sale`.

---

## PHASE 2 — The bug that will bite you on iOS (1 day)

> Goal: fix the bugs the App Store reviewers and your vendors will hit on day 1.

- [ ] **P2.1** `🔴` **Fix `Product.vendor` id-space mismatch**
  - **Goal:** Today `Product.vendor` is a `User._id` but
    `GET /api/vendors/me/products` queries with a `Vendor._id`. Vendor portals
    show empty for real vendors.
  - **Approach (do not refactor wholesale):**
    1. Add a `vendorUserId` mirror to `Product` (write both at create/update).
    2. In `routes/vendors.js#GET /me/products`, query
       `Product.find({ $or: [{ vendor: vendor._id }, { vendorUserId: vendor.owner }] })`.
    3. One-time migration script (`node scripts/migrate-vendor-ids.js`) to
       backfill `vendorUserId` for existing docs.
  - **Files:** `backend/src/models/Product.js`,
    `backend/src/routes/products.js` (write both on POST/PUT),
    `backend/src/routes/vendors.js` (broaden the query),
    new `backend/scripts/migrate-vendor-ids.js`.
  - **Verify:** Vendor logs in to `/dashboard/products`, sees the products
    they created. Vendor who's been on the platform for 6 months isn't suddenly
    empty-handed.

- [ ] **P2.2** `🟡` **Reconcile the two competing entry redirects**
  - **Goal:** `app/_layout.tsx` and `app/index.tsx` both decide where the user
    goes on launch. They disagree.
  - **Approach:** `app/index.tsx` becomes a 200ms splash that just renders a
    `<Redirect href="/(tabs)/home" />` (or a `Loading…` skeleton). All routing
    logic moves to `app/_layout.tsx`. Remove the AsyncStorage-onboarding check
    from `app/index.tsx`.
  - **Files:** `frontend/app/index.tsx`, `frontend/app/_layout.tsx`.
  - **Verify:** Cold-launch a logged-in, onboarded user → goes to `/(tabs)/home`
    exactly once. Cold-launch a logged-in, *not*-onboarded user → onboarding.
    Cold-launch a guest → `/(tabs)/home`. No flash of the wrong screen.

- [ ] **P2.3** `🟡` **Fix `loadUser` emptying the wishlist on network blip**
  - **Goal:** `apiCall` returns `{ message: "…" }` on error. `loadUser` sees a
    non-array and clears the local wishlist. A flaky network on cold-start
    silently nukes the UI state.
  - **Approach:** Only overwrite local wishlist if the response is an array
    AND non-empty. Always show the persisted AsyncStorage wishlist on launch.
  - **Files:** `frontend/src/state/auth.ts` (both `login` and `loadUser`).
  - **Verify:** Disable network mid-cold-start. App still shows persisted
    wishlist on launch (no flicker to empty).

- [ ] **P2.4** `🟡` **Fix the latent `ITEMS` ReferenceError in the recommender**
  - **Goal:** `recommender.ts#getInitialItems` references a global `ITEMS` that
    is never imported. Cold-start path explodes.
  - **Approach:** Either import a static seed from `src/data/items.ts`
    (creating it if absent), or delete the fallback entirely. Today the home
    feed uses `useHomeScreenData`, so the safe move is to delete the fallback
    and let the recommender be a pure re-ranker.
  - **Files:** `frontend/src/lib/recommender.ts`.
  - **Verify:** `npx tsc --noEmit` doesn't catch it (it's `any`-typed by
    global). Manual: `node -e "require('./frontend/src/lib/recommender')"`
    in a TS-aware runner, or call `getInitialItems()` in a dev test.

---

## PHASE 3 — UX pass (3–5 days, mobile-first)

> Goal: the design is fine, the *experience* is broken. Tighten the journey
> from cold launch to first purchase. **No UI redesign** — just removal of
> friction.

- [ ] **P3.1** `🟢` **Onboarding: real skip + sample feed for un-onboarded users**
  - **Goal:** The home feed breaks for users with no selected categories. Show
    a generic, recency-sorted feed by default. Onboarding becomes a "tune your
    feed" prompt, not a gate.
  - **Files:** `frontend/src/hooks/useHomeScreenData.ts`,
    `frontend/app/(tabs)/home.tsx`, `frontend/app/onboarding.tsx`.
  - **Verify:** Skip onboarding, land on home, see real products.

- [ ] **P3.2** `🟢` **Empty states for cart, wishlist, orders, notifications**
  - **Goal:** Every list screen has an illustrated empty state with a primary
    CTA ("Browse the home feed", "Sign in to see orders").
  - **Files:** `frontend/src/components/home/EmptyState.tsx` (already exists —
    reuse + propagate).
  - **Verify:** Empty cart on iOS dev client. Tap the CTA, lands on home.

- [ ] **P3.3** `🟢` **Skeleton loaders for home + product detail**
  - **Goal:** Replace per-screen spinners with skeleton cards. Already have an
    `AnimatedLoadingScreen`; consider extracting a `<Skeleton />` primitive.
  - **Files:** new `frontend/src/components/common/Skeleton.tsx`,
    `frontend/app/(tabs)/home.tsx`, `frontend/app/product/[id].tsx`.
  - **Verify:** Cold launch on iOS, perceived load time drops.

- [ ] **P3.4** `🟢` **Swipe-deck tutorial (first launch only)**
  - **Goal:** A 3-overlay tutorial (← pass, → like, ↑ cart, long-press = details).
    Dismiss persists in AsyncStorage.
  - **Files:** new `frontend/src/components/home/SwipeTutorial.tsx`,
    `frontend/app/(tabs)/home.tsx`.
  - **Verify:** Fresh install on iOS dev client, see tutorial once, never again.

- [ ] **P3.5** `🟢` **Search: sticky, visible, with recent + suggested**
  - **Goal:** `app/(tabs)/search.tsx` exists but search is hidden behind a
    tap. Make it a top-level tab with the search input always visible.
  - **Files:** `frontend/app/(tabs)/search.tsx`,
    `frontend/app/(tabs)/_layout.tsx`,
    `frontend/src/lib/storage.ts` (recent searches already there).
  - **Verify:** Tap search tab, type, results appear, recent searches visible
    on focus.

- [ ] **P3.6** `🟢` **Toasts reachable from admin & vendor screens**
  - **Goal:** Confirm `<Toast />` in `app/_layout.tsx` covers all stack
    screens. Move it inside the Stack so it overlays the whole app.
  - **Files:** `frontend/app/_layout.tsx`, `frontend/src/components/Toast.tsx`.
  - **Verify:** Trigger an action in `/admin`, see toast.

- [ ] **P3.7** `🟢` **End-to-end QA pass on Account screens (iOS)**
  - **Goal:** Many of `app/account/*.tsx` (change-password, add-address,
    edit-payment-method, edit-address, payment) were tested on web. Re-verify
    each one on the iOS dev client.
  - **Files:** the entire `frontend/app/account/` folder.
  - **Verify:** Walk through every Account screen, every flow, on iPhone.

- [ ] **P3.8** `🟢` **Error boundary**
  - **Goal:** One top-level `ErrorBoundary` in `_layout.tsx`. Today a render
    throw blanks the app.
  - **Files:** new `frontend/src/components/common/ErrorBoundary.tsx`,
    `frontend/app/_layout.tsx`.
  - **Verify:** Throw in a child component on dev — see fallback, not blank.

---

## PHASE 4 — Website UI/UX polish (2–3 days, after iOS is on TestFlight)

- [ ] **P4.1** `🟡` **No-flash auth guard on `/dashboard`**
  - **Goal:** Stop the SSR-flash-login pattern. Render a skeleton until
    `useAuth().loading` is false, then either render children or `<Redirect>`.
  - **Files:** `website/src/app/dashboard/layout.tsx`,
    `website/src/contexts/AuthContext.tsx`.
  - **Verify:** Hard refresh `/dashboard/products` — no flash of login.

- [ ] **P4.2** `🟢` **Per-route code splitting for chart-heavy pages**
  - **Goal:** `recharts` is huge. Lazy-load.
  - **Files:** `website/src/app/dashboard/analytics/page.tsx`,
    `website/src/components/...chart...` (if any).
  - **Verify:** Network tab on `/dashboard` shows recharts only on
    `/dashboard/analytics`.

- [ ] **P4.3** `🟢` **Real navigation component**
  - **Goal:** Each page hand-rolls a header. Extract `<SiteHeader />`,
    `<DashboardHeader />`, `<AdminHeader />`.
  - **Files:** new `website/src/components/headers/…`, the three top-level
    `layout.tsx` files.
  - **Verify:** Visual consistency across pages, less duplicate markup.

- [ ] **P4.4** `🟢` **Landing page: mobile + LCP pass**
  - **Goal:** The `/` page is a 600-line Tailwind wall. Add `priority` to the
    first hero `<img>`, lazy-load below-the-fold, respect
    `prefers-reduced-motion`.
  - **Files:** `website/src/app/page.tsx`.
  - **Verify:** Lighthouse mobile score goes up; LCP < 2.5s on a throttled run.

- [ ] **P4.5** `🟢` **Accessibility sweep**
  - **Goal:** `aria-label` on icon buttons, focus states, `prefers-reduced-motion`.
  - **Files:** all `website/src/components/*`, all `website/src/app/**/page.tsx`.
  - **Verify:** Tab through `/dashboard/products` with keyboard only — every
    control reachable and labeled.

---

## PHASE 5 — Architectural robustness (after iOS ships)

> Defer until App Store build is `Ready for Sale`. Don't ship iOS with a
> refactor in flight.

- [ ] **P5.1** `🟡` **`requireRole` middleware**
  - **Goal:** Replace 10 copy-pasted `if (req.user.role !== '…')` blocks.
  - **Files:** new `backend/src/middleware/requireRole.js`, refactor
    `routes/products.js`, `routes/upload.js`, `routes/vendors.js`,
    `routes/analytics.js`, `routes/analytics/vendor.js`.
  - **Verify:** `grep -rn "req.user.role" backend/src/routes` returns 0 lines
    in handlers.

- [ ] **P5.2** `🟡` **Move uploads to S3**
  - **Goal:** Local-disk uploads die on AWS restarts. Use S3 with presigned
    URLs.
  - **Files:** `backend/src/routes/upload.js`, new
    `backend/src/utils/s3.js`, `backend/package.json` (`@aws-sdk/client-s3`),
    env var `AWS_S3_BUCKET`.
  - **Verify:** Upload an image, restart the container, image still serves.

- [ ] **P5.3** `🟢` **Replace `console.log` with `pino`**
  - **Goal:** Structured JSON logs for CloudWatch.
  - **Files:** `backend/server.js`, all `routes/*.js`, all `utils/*.js`.
  - **Verify:** `tail -f` shows JSON lines with `level`, `msg`, `path`, `ms`.

- [ ] **P5.4** `🟡` **Zod request validation**
  - **Goal:** All `POST/PUT` routes validate body shape.
  - **Files:** new `backend/src/middleware/validate.js`, refactor
    `routes/auth.js`, `routes/products.js`, `routes/vendors.js`,
    `routes/users.js`, `routes/orders.js`, `routes/cart.js`.
  - **Verify:** POST a malformed product → 400 with a clear field list,
    not a Mongoose `ValidationError` blob.

- [ ] **P5.5** `🟡` **Shared types package**
  - **Goal:** One source of truth for `Item` / `Product` / `Address` /
    `User.role` across all three apps.
  - **Files:** new `packages/shared/` at the repo root containing `.ts` types
    and a small `imageUrl()` helper. Each app: `npm install ../packages/shared`.
  - **Verify:** Change a type in `shared/`, all three apps fail typecheck.

- [ ] **P5.6** `🟢` **Delete dead code**
  - **Goal:** `backend/src/utils/productMapping.js` is unused legacy.
  - **Files:** delete the file. Same for the `ITEMS` fallback in
    `recommender.ts` (covered in P2.4).
  - **Verify:** `grep -rn productMapping backend/src/routes` returns 0 matches.

- [ ] **P5.7** `🟡` **`next/middleware.ts` auth gate**
  - **Goal:** Stop serving `/dashboard/*` to unauthenticated users. The
    client-side `AuthContext` is not enough.
  - **Files:** new `website/src/middleware.ts` reading a cookie or Bearer
    header. Move token storage to a cookie (`httpOnly`, `sameSite: lax`).
  - **Verify:** `curl -i https://dryp.com/dashboard/products` (no cookie) →
    302 to `/login`.

- [ ] **P5.8** `🟢` **Rate-limit product/cart/wishlist**
  - **Goal:** Only auth and vendor signup are limited today. Add a sensible
    general limit.
  - **Files:** `backend/server.js` — add an `apiLimiter` and apply to
    `/api/products`, `/api/cart`, `/api/wishlist`, `/api/likes`.
  - **Verify:** Hammer `/api/cart` 200 times in a minute → 429.

---

## Cross-cutting rules

- **One PR per `[ ]`.** Don't bundle. Easier to revert.
- **No architectural rewrite mid-phase.** Phase 5 exists so you can defer
  refactors without losing them.
- **Branch off `main`**, PR back to `main`. Tag iOS TestFlight builds
  (`v0.1.0-ios-tf1`).
- **Each PR must include a manual test note in the description** (iOS or web
  build link, what was tapped, what was observed). "Looks good" is not a
  test.
- **iOS device required** for verifying P1.x. Borrow a phone or use TestFlight
  on a real iPhone — simulator optional.
