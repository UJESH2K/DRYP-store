## ADDED Requirements

### Requirement: Google registration drafts are server-backed
The system SHALL persist pre-OAuth brand name and portfolio URL in a short-lived server-backed draft and SHALL place only an opaque draft reference in signed OAuth state.

#### Scenario: Draft creation
- **WHEN** a visitor submits valid Google registration details
- **THEN** the backend creates a draft with a random identifier, normalized fields, an expiry, and an unused state

#### Scenario: Tampered client parameters
- **WHEN** callback query parameters attempt to replace the draft brand name, portfolio, or Google email
- **THEN** the system ignores the client values and uses only the stored draft and verified Google identity

### Requirement: Google registration drafts are single-use and expiring
The system SHALL reject expired, missing, or already-consumed drafts and SHALL consume a valid draft atomically when creating the pending application.

#### Scenario: Valid draft consumption
- **WHEN** a new Google identity returns with a valid unused draft
- **THEN** the system creates one pending application and marks or deletes the draft in the same logical operation

#### Scenario: Draft replay
- **WHEN** the same OAuth callback or draft reference is replayed
- **THEN** the system creates no additional application and fails closed with a generic registration error

### Requirement: OAuth intent is explicit and signed
The system SHALL preserve `register` or `login` intent and `web` or `mobile` platform in signed, expiring OAuth state.

#### Scenario: Register state
- **WHEN** Google OAuth starts from a valid registration draft
- **THEN** signed state contains register intent, web platform, and the opaque draft identifier

#### Scenario: Login state
- **WHEN** Google OAuth starts from `/login`
- **THEN** signed state contains login intent and no registration draft

### Requirement: Registration details gate Google OAuth
The system SHALL not start Google OAuth for registration until required draft fields pass validation.

#### Scenario: Direct OAuth registration call without draft
- **WHEN** a client requests register-intent Google OAuth without a valid draft reference
- **THEN** the backend rejects or redirects to `/register` without contacting Google
