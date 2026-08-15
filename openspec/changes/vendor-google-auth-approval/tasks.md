## 1. Backend Google approval gate

- [x] 1.1 Add VendorApplication lookup in `googleAuth.js` after email is known
- [x] 1.2 Allow returning active vendor/admin without new application
- [x] 1.3 Deny with `no_application` / `application_pending` / `application_rejected` (no JWT)
- [x] 1.4 Stop promoting non-vendor users to vendor without approved application

## 2. Approval email + website errors

- [x] 2.1 Update approval email in `vendors.js` to link `/login` (Google path)
- [x] 2.2 Extend Google callback `ERROR_MESSAGES` + CTAs for new error codes
- [x] 2.3 Ensure login/signup copy points unapproved users to `/apply`

## 3. Verify

- [x] 3.1 Code review against OpenSpec scenarios
- [x] 3.2 Document Google Console / prod env checklist in AGENTS or change note
