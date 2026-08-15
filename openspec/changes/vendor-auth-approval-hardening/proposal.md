## Why

The website vendor flow currently blurs registration and login and can treat Google authentication as an access decision instead of a credential method. DRYP needs one enforceable lifecycle in which both email and Google applicants enter the same waitlist and only admin approval unlocks the vendor portal.

## What Changes

- Split website vendor registration into explicit Email and Google methods while keeping `/login` login-only.
- Require brand name and portfolio before starting Google OAuth; Google supplies the verified email after authentication, so the Google form never asks for email.
- Store pre-Google brand details in a short-lived server-backed registration draft referenced by signed OAuth state rather than trusting query parameters.
- Complete a new Google registration by creating only a pending `VendorApplication`, then show a waitlist-only result with no JWT, User, Vendor, dashboard, upload, or Shopify access.
- Route an already-approved active Gmail identity directly to the vendor portal and route pending, rejected, and suspended identities to explicit non-authenticated status states.
- Preserve manual registration as brand name, contact email, and portfolio followed by the same pending waitlist.
- Harden identity linking, duplicate/collision handling, approval-time password setup, forgot-password, OAuth rate limiting, and other vendor entry points.
- Add unit, integration, and Playwright regression coverage for the complete vendor lifecycle.
- **BREAKING**: Client-supplied `googleEmail` is no longer accepted as proof of Google ownership; verified Google identity data must come from the OAuth callback.

## Capabilities

### New Capabilities
- `vendor-auth-lifecycle`: Defines manual and Google registration, waitlist states, admin approval, approved login, secure password setup, and vendor-route authorization.
- `vendor-google-registration-draft`: Defines the secure pre-OAuth draft used to carry brand and portfolio details through Google authentication without asking for email.
- `vendor-identity-linking`: Defines deterministic, collision-safe linking between contact email, verified Google identity, applications, users, and vendor profiles.

### Modified Capabilities

None. No main OpenSpec capability currently defines this behavior; the earlier unarchived `vendor-google-auth-approval` change is superseded by this end-to-end lifecycle specification.

## Impact

- Backend: Google OAuth routes, vendor application/approval/login routes, password reset routes, models/indexes, rate limiting, Shopify/vendor entry-point authorization, and auth tests.
- Website: `/register`, `/login`, `/apply`, `/signup`, password recovery/status screens, dashboard gate, and Playwright coverage.
- Data: `VendorApplication` requires verified Google identity metadata and collision-safe indexes; existing data must be audited before uniqueness is enabled.
- Operations: Google redirect URIs and backend/frontend production URLs must remain exact; database migration and deployment ordering are required.
