# Vendor Auth Approval Hardening — Migration & Deployment

## Overview

This change hardens the vendor registration and authentication flow to enforce
an approval-first policy: no vendor account (User with `role: 'vendor'` or a
Vendor profile) is created without an approved `VendorApplication`.

## Database Migration

### New fields on VendorApplication

The `VendorApplication` model gained verified Google identity fields:

- `verifiedGoogleId` (String) — Google OAuth subject ID
- `verifiedGoogleEmail` (String) — verified Google email
- `googleEmail` (String) — legacy Google email field

Partial unique indexes enforce identity uniqueness:
- `{ verifiedGoogleId: 1 }` with `partialFilterExpression: { verifiedGoogleId: { $ne: null } }`
- `{ verifiedGoogleEmail: 1 }` with `partialFilterExpression: { verifiedGoogleEmail: { $ne: null } }`

**Action:** Run `node scripts/migrate-identity-fields.js` (or ensure indexes are
created automatically by Mongoose on server start). No existing data is modified;
the fields are optional and default to absent.

### User model

- `authProvider` enum now includes `"google"` and `"invited"`.
- `resetPasswordToken` / `resetPasswordExpire` fields already existed; now used
  for both approval-time setup tokens (7-day expiry) and forgot-password
  (10-minute expiry), both hashed via `hashPasswordToken()`.

## Environment Variables

Ensure these are set in `backend/.env`:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SHOPIFY_APP_URL=http://localhost:8081   # or prod API base
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000   # or https://www.dryp.store
OPENAI_API_KEY=sk-...   # only for AI chatbot, not required for auth
MONGO_URI=...
JWT_SECRET=...
```

Google Cloud Console must list the exact redirect URI(s):
- Local: `http://localhost:8081/api/auth/google/callback`
- Prod: `https://api.dryp.store/api/auth/google/callback`

## Deployment Steps

1. **Deploy backend** — no breaking changes to existing endpoints. The approval
   flow (`processApplicationDecision`) is now atomic (Mongoose transaction).
2. **Deploy website** — new pages: `/register` (redesigned), `/apply` (redirect),
   `/signup` (redirect). AuthContext validates sessions against `/api/auth/me`.
3. **Run Atlas Vector Search index** if not already done (for AI chatbot; unrelated
   to auth but included for completeness).
4. **Batch-embed existing products** if `OPENAI_API_KEY` was just added:
   `POST /api/ai/embed-products` (admin token required).

## Test Suites

### Backend (run from `backend/`)

```bash
npm test                                              # unit suites (no DB)
node tests/googleIdentityResolution.test.js           # 21 tests (no DB)
node tests/vendorApproval.integration.test.js          # 7 tests (needs MONGO_URI)
node tests/vendorLifecycle.integration.test.js         # 8 tests (needs MONGO_URI)
```

### Website (run from `website/`)

```bash
npx playwright test                                   # e2e (needs dev server + backend)
npx playwright test --grep "Legacy redirects"         # subset
```

Playwright requires the full stack running (website dev server + backend +
MongoDB). Set `E2E_SKIP_SERVER=1` to skip auto-starting the dev server.

## Security Notes

- All OAuth identity resolution uses verified Google subject IDs + emails from
  the OAuth userinfo response, never client-supplied values.
- Duplicate-key races are handled via Mongoose transactions + E11000 catch →
  generic non-enumerating `identity_collision` / `conflict` errors.
- Anonymous Shopify OAuth can no longer create a vendor without an approved
  application (gate added in `shopifyAuth.js`).
- Password setup tokens are hashed at rest (SHA-256); only the raw token appears
  in the emailed URL. Single-use: cleared on password set.
- AuthContext (website) validates the stored JWT against `/api/auth/me` on mount;
  stale/suspended sessions are cleared.
