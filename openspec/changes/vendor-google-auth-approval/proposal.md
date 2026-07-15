## Why

Vendor studio Google login currently **auto-creates vendors** for any Google account and **skips** the apply → admin review → accept flow that already exists for email registration. Production `dryp.store` also needs a correct OAuth redirect chain. Without an approval gate on Google, curation is bypassed and the product plan is wrong.

## What Changes

- **Gate Google OAuth** on an approved `VendorApplication` for that email (or existing active vendor/admin login).
- **Deny** Google sign-in when there is no application, status is pending, or status is rejected — with clear website error messages and CTAs.
- **Do not mint a JWT** for denied cases.
- **Stop promoting** random existing `user`-role accounts to vendor via Google without approval.
- **Update approval email** to point approved studios to **login with Google** (and keep email signup as secondary).
- **Website UX**: login primary = Google; apply-first messaging; callback error map for approval states.
- **Ops notes** for Google Cloud redirect URIs (localhost + prod) — no secrets in git.

## Capabilities

### New Capabilities

- `vendor-google-auth`: Approval-gated Google OAuth for the vendor studio website, aligned with apply → admin approve → login → catalog upload.

### Modified Capabilities

- (none existing in `openspec/specs/` — greenfield capability)

## Impact

- `backend/src/routes/googleAuth.js` — primary gate
- `backend/src/routes/vendors.js` — approval email copy
- `website/src/app/oauth/google/callback/page.tsx` — error messages + CTAs
- `website/src/app/login/page.tsx` / `signup/page.tsx` — apply-first copy (if needed)
- Env: `SHOPIFY_APP_URL`, `NEXT_PUBLIC_FRONTEND_URL`, Google Console URIs (ops)
- No mobile Expo scope in this change
