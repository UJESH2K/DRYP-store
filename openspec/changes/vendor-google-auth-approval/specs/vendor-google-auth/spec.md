## ADDED Requirements

### Requirement: Google OAuth requires approved vendor application

The system MUST allow Google OAuth completion for the vendor studio only when the Google account email is associated with an approved studio application, or when an existing active vendor or admin user already exists for that email.

#### Scenario: Approved application first-time Google login

- **WHEN** a user completes Google OAuth with an email that has `VendorApplication.status === 'approved'` and no user account yet
- **THEN** the system creates a vendor user and vendor profile, mints a session token, and redirects the website callback with a token

#### Scenario: Returning active vendor Google login

- **WHEN** a user completes Google OAuth with an email that already has an active user with role `vendor` or `admin`
- **THEN** the system logs them in without requiring a new application check to pass for first-time creation

#### Scenario: No application

- **WHEN** a user completes Google OAuth with an email that has no `VendorApplication` and is not an existing vendor or admin
- **THEN** the system MUST NOT mint a JWT and MUST redirect to the website callback with `error=no_application`

#### Scenario: Pending application

- **WHEN** a user completes Google OAuth with an email whose application status is `pending`
- **THEN** the system MUST NOT mint a JWT and MUST redirect with `error=application_pending`

#### Scenario: Rejected application

- **WHEN** a user completes Google OAuth with an email whose application status is `rejected`
- **THEN** the system MUST NOT mint a JWT and MUST redirect with `error=application_rejected`

### Requirement: No silent vendor role escalation without approval

The system MUST NOT promote an existing non-vendor, non-admin user to vendor via Google OAuth unless that email has an approved `VendorApplication`.

#### Scenario: Shopper account tries Google studio login without approval

- **WHEN** a user with role `user` signs in with Google and has no approved application
- **THEN** the system denies access with an application-related error and does not change their role to vendor

### Requirement: Website surfaces Google approval errors

The website OAuth callback page MUST display human-readable messages for approval-related Google errors and provide navigation to apply or login as appropriate.

#### Scenario: Pending error UI

- **WHEN** the callback URL contains `error=application_pending`
- **THEN** the page shows that the application is under review and does not call login

#### Scenario: No application error UI

- **WHEN** the callback URL contains `error=no_application`
- **THEN** the page shows that the user must apply first and links to `/apply`

### Requirement: Approval email invites Google login

When an admin approves a vendor application, the acceptance email MUST instruct the studio to sign in at the website login page (Google primary path supported).

#### Scenario: Admin approves application

- **WHEN** an admin sets application status to `approved`
- **THEN** the email body includes a link to the frontend login page where Google sign-in is available
