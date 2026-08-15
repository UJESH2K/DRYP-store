## Context

DRYP vendor website already has:
- Apply form → `VendorApplication` (pending/approved/rejected)
- Admin approve/reject + email
- Email register gated on `status === 'approved'`
- Google OAuth that **bypasses** approval and auto-creates vendors

Intended product flow:
`Apply → Admin review → Accept email → Google login → Manual / Excel / Shopify upload`

## Goals / Non-Goals

**Goals:**
- Enforce the same approval gate for Google as for email registration
- Clear denial UX for no app / pending / rejected
- Existing active vendors/admins can still Google-login without re-applying
- Approval email tells vendors to use Google login (primary) or email signup
- Document production Google redirect env requirements

**Non-Goals:**
- Mobile Expo Supabase Google
- Changing admin applications UI beyond email text
- Full Shopify OAuth bulk import
- Moving JWT out of query string (note as future hardening only)
- Main branch merge / production deploy automation

## Decisions

1. **Single choke point: backend `googleAuth` callback**  
   After Google email is known, before User create/upgrade or JWT mint. Website-only checks are insufficient.

2. **Allowlist for login without new application**  
   If `User` exists with `role === 'vendor' | 'admin'` and `isActive`, allow Google login (returning studio).  
   If user exists with other roles and no approved application → deny (no silent role escalate).

3. **New users require approved application**  
   Same rule as `POST /api/vendors/register`.

4. **Error codes via redirect query** (no token):  
   `no_application` | `application_pending` | `application_rejected` (+ existing oauth errors)

5. **Keep email/password as secondary** after approval (no removal).

6. **Env naming**: continue using `SHOPIFY_APP_URL` as Google redirect base (existing) — document clearly; rename later is out of scope.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Vendors already created via open Google gate | Returning vendor/admin still login; optionally admin cleans junk Vendor rows |
| Email case mismatch | Always lowercase email for application lookup |
| Production redirect mismatch | Ops checklist: Console URIs must match `SHOPIFY_APP_URL` |
| Approval email still SMTP-dependent | Existing sendEmail; fail soft on mail already in approve path |

## Migration Plan

1. Deploy backend gate first (breaks open Google signup — intentional).  
2. Deploy website error messages same release.  
3. Ensure Google Console has localhost + prod callback URIs.  
4. Rollback: revert `googleAuth.js` only if emergency (re-opens gate).

## Open Questions

- None blocking: product owner confirmed apply → approve → Google login → catalog.
