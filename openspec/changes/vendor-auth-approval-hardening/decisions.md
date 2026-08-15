# Decisions

## 4.2 Admin approval is atomic (transaction-wrapped)

- The approve/reject decision runs inside a single Mongoose session transaction covering the application status flip, invited User create/upgrade, Vendor profile creation, and the hashed one-time password setup token. All four commit together or not at all.
- The notification email is sent only after `commitTransaction` succeeds. A failed write never mails a false approval; a failed email never leaves a half-committed approval (state is already fully committed by then).
- Duplicate-key races (E11000 on `User.email` / `Vendor.email`) abort the transaction, return `{ ok: false, error: 'conflict' }` → HTTP 409, and the application remains `pending` so it can be re-decided. The error is generic and non-enumerating.
- The approval email carries the raw setup token in `/reset-password/<raw>`; only its hash (`createPasswordToken` → `hashPasswordToken`) is stored on the invited user inside the same transaction, so the raw token never touches the database.
- Pattern source: `consumeDraftAndCreateApplication` in `backend/src/routes/googleAuth.js` (start session → write with `{ session }` → commit/abort → end session; 11000 mapped to a generic result).
