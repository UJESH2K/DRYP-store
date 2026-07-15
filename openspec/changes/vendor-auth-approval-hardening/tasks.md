## 1. Regression Tests and Identity Foundations

- [x] 1.1 Add failing unit tests for Google register/login intent, required pre-OAuth details, draft expiry/replay, and waitlist-only outcomes
- [ ] 1.2 Add failing tests for verified Google identity resolution, duplicate/cross-field collision rejection, and canonical User/Vendor linking
- [x] 1.3 Extend VendorApplication with verified Google subject/email fields and add an audit-first identity migration/index script

## 2. Secure Google Registration Draft

- [x] 2.1 Add a TTL-backed Google vendor registration draft model with random opaque ID, normalized brand/portfolio fields, expiry, and consumed state
- [x] 2.2 Add a rate-limited backend endpoint that validates brand and portfolio and creates a draft without accepting an email
- [x] 2.3 Require a valid draft for register-intent Google OAuth and carry only the draft ID in signed expiring state
- [x] 2.4 Consume a valid draft atomically after Google verification to create exactly one pending VendorApplication with verified Google subject/email and no User, Vendor, or JWT

## 3. Google Login and Approval Gate

- [x] 3.1 Refactor Google callback resolution so approved active identities enter the vendor portal and pending/rejected/suspended identities receive no JWT
- [ ] 3.2 Link approved contact and verified Google identities to one canonical User/Vendor account and handle duplicate creation races safely
- [x] 3.3 Add a dedicated Google OAuth rate limiter and preserve separate mobile customer behavior
- [ ] 3.4 Audit and gate anonymous Shopify/vendor creation paths under the same approval policy while preserving authenticated vendor store connection

## 4. Manual Registration, Approval, and Password Flow

- [x] 4.1 Keep manual registration limited to brand, contact email, and portfolio and remove client-controlled Google email claims
- [ ] 4.2 Make admin approval atomic across application status, invited User, Vendor profile, and hashed one-time password setup token
- [ ] 4.3 Canonicalize `/reset-password/[token]` for approval-time setup and forgot-password, enforce password policy, expiry, single use, and generic responses
- [ ] 4.4 Keep `/apply` as a redirect and prevent `/signup` from acting as an independent unapproved registration path

## 5. Website Vendor UX

- [x] 5.1 Redesign `/register` with explicit Email and Google methods: email asks brand/email/portfolio; Google asks brand/portfolio before OAuth and blocks incomplete submission
- [x] 5.2 Add clear waitlist, rejected, suspended, draft-expired, and registration-error states with no dashboard/upload actions
- [ ] 5.3 Keep `/login` login-only with Google, email/password, forgot-password, and register navigation
- [ ] 5.4 Verify dashboard and protected vendor navigation never render for unauthenticated or unapproved applicants

## 6. Integration and Browser Verification

- [ ] 6.1 Add backend integration coverage for manual apply, Google draft consumption, pending/rejected denial, approved login, password setup/reset, and route authorization
- [ ] 6.2 Add Playwright coverage for both registration methods, required-field gating, waitlist/rejected states, login-only UI, legacy redirects, and password recovery
- [x] 6.3 Run backend syntax/tests and website targeted lint, typecheck, production build, and real-browser responsive QA; separate pre-existing failures from regressions
- [ ] 6.4 Clean temporary users, applications, drafts, screenshots, traces, and debug artifacts; document migration and deployment steps
