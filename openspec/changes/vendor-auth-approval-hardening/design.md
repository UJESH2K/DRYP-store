## Context

The website currently supports manual applications, Google OAuth, password registration/reset, admin approval, and Shopify onboarding through partially separate paths. The revised UX requires manual registration to collect brand, email, and portfolio, while Google registration collects only brand and portfolio before OAuth and derives email from Google. The security boundary is admin approval: no pre-approval route may create a vendor session or expose dashboard/upload/Shopify capabilities.

The repository has independent npm packages and a dirty working tree with earlier auth work. Implementation must be surgical and must not reset unrelated changes. Existing `sxvocusa@gmail.com` data is already approved and must remain a valid returning-vendor case.

## Goals / Non-Goals

**Goals:**
- Make registration method selection obvious and make Google registration impossible until brand and portfolio are complete.
- Carry pre-OAuth business details securely without trusting callback query parameters.
- Create only a pending application for new Google identities and show a waitlist-only result.
- Send already-approved active Gmail identities to the vendor portal.
- Make Google identity linking deterministic and collision-safe.
- Preserve strong manual application, password setup/recovery, mobile-customer separation, and protected vendor capabilities.

**Non-Goals:**
- Redesign the vendor dashboard or product upload experiences.
- Merge website and mobile authentication sessions.
- Replace Google OAuth or MongoDB/Mongoose.
- Commit, push, or rewrite unrelated worktree changes.

## Decisions

### Use a server-backed pre-OAuth registration draft

The website will POST `{ studioName, websiteOrPortfolio }` to a dedicated backend draft endpoint. The backend validates the fields and stores a short-lived draft with a random opaque ID, expiry, and unused state. Google OAuth state contains the signed draft ID, intent, and platform—not the business fields.

This is preferred over query parameters because query values are client-controlled, and preferred over embedding all fields in JWT state because OAuth URLs leak into browser history and logs and should contain minimal business data.

### Separate register and login Google intents

`/register` starts `intent=register` only after draft creation. `/login` starts `intent=login` without a draft. The callback validates state and branches:

- Existing active vendor/admin or approved linked application: authenticate and enter the portal.
- Register intent + new identity + valid draft: atomically create one pending application, consume draft, redirect to waitlist, no JWT.
- Login intent + no application: redirect to `/register` without a session.
- Pending/rejected/suspended: redirect to explicit non-authenticated status.

Approved identities take precedence even when OAuth began from `/register`, satisfying the requirement that a Gmail account with existing access enters the vendor portal.

### Use verified Google subject ID as the durable identity

VendorApplication will store verified Google subject ID and normalized Google email only when populated by the OAuth callback. Resolution prefers subject ID. Email fallback is allowed only when exactly one application/user matches. Ambiguity fails closed.

Manual forms will no longer accept `googleEmail`. A manual applicant can later link Google only through a verified flow after approval or an explicit secure linking operation.

### Enforce uniqueness after an audit migration

A migration script will report duplicate Google subject IDs, duplicate Google emails, and contact-email/Google-email cross-field collisions. Deployment must resolve collisions before unique partial indexes are enabled. Duplicate-key errors at runtime return a generic application result and never grant access.

### Keep one approval and password lifecycle

Admin approval atomically updates the application, creates/updates the canonical invited vendor User and Vendor profile, and creates a hashed one-time password token. The email offers the canonical reset-password URL and Google login. No plaintext password or JWT is sent.

### Gate Shopify and protected vendor surfaces

Anonymous Shopify OAuth may not create a vendor unless an approved application is matched. Existing authenticated active vendors may connect Shopify after login. Dashboard, upload, import, and presign routes retain role and active-account authorization checks.

## Risks / Trade-offs

- [Draft storage adds a new collection and cleanup responsibility] → Use TTL indexing plus atomic consumed-state handling.
- [Existing identity data may violate new uniqueness rules] → Run an audit-only migration first, resolve collisions, then add indexes.
- [A user starting registration with an already-approved Gmail bypasses the draft] → This is intentional; existing approved access takes precedence and the unused draft expires automatically.
- [Email fallback can remain ambiguous during migration] → Require exactly one match and fail closed otherwise.
- [MongoDB transactions require replica-set support] → Atlas supports them; tests must surface unsupported local configurations.
- [OAuth callback complexity grows] → Extract draft resolution and identity resolution into tested utilities/services rather than adding more branches to the route.

## Migration Plan

1. Add draft and verified identity fields without unique constraints.
2. Add audit script and run it against the configured database without mutation.
3. Resolve duplicate/cross-field collisions and document canonical users/applications.
4. Deploy backend draft, callback, waitlist, approval, and gate behavior.
5. Deploy website registration modes and status states with the backend.
6. Enable partial unique indexes after the audit is clean.
7. Run local and deployed browser/API verification.

Rollback: keep old fields readable during one deployment window, disable new index creation if collisions are found, and redirect Google registration to manual registration rather than weakening the approval gate.

## Open Questions

- Whether production can use an HttpOnly cookie for the final web session instead of the current token callback; implementation may keep the current callback contract if changing it would expand this change beyond the approval fix.
- Whether rejected applicants may submit a new application immediately or require admin support; until product policy is explicit, the UI will show a safe contact/review message and no automatic reapplication.
