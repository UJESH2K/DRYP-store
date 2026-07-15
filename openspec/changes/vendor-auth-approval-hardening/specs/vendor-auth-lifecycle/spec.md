## ADDED Requirements

### Requirement: Manual vendor registration enters the waitlist
The system SHALL require brand name, contact email, and portfolio URL for manual vendor registration and SHALL create only a pending VendorApplication.

#### Scenario: Complete manual application
- **WHEN** a new applicant submits valid brand name, contact email, and portfolio URL
- **THEN** the system creates a pending VendorApplication, creates no User or Vendor, returns no JWT, and shows the waitlist state

#### Scenario: Incomplete manual application
- **WHEN** an applicant omits brand name, contact email, or portfolio URL
- **THEN** the system rejects submission without starting authentication or creating records

### Requirement: Google vendor registration collects business details before OAuth
The website SHALL require brand name and portfolio URL before starting Google OAuth and SHALL not request an email in the Google registration form.

#### Scenario: Incomplete Google registration details
- **WHEN** an applicant clicks Continue with Google without both brand name and portfolio URL
- **THEN** the website keeps the applicant on `/register`, identifies the missing fields, and does not start OAuth

#### Scenario: Complete Google registration details
- **WHEN** an applicant provides brand name and portfolio URL and clicks Continue with Google
- **THEN** the system stores a short-lived registration draft and starts Google OAuth without asking for an email

### Requirement: New Google applicants enter the waitlist
The system SHALL use the verified Google identity as the application email and SHALL create only a pending VendorApplication for an unapproved Google identity.

#### Scenario: New verified Google identity
- **WHEN** Google returns a verified identity with no existing application or vendor access and a valid registration draft exists
- **THEN** the system creates a pending VendorApplication from the draft and verified identity, issues no JWT, creates no User or Vendor, and redirects to the waitlist state

### Requirement: Approved Gmail identities enter the vendor portal
The system SHALL allow an active vendor or an identity linked to an approved application to authenticate through Google.

#### Scenario: Approved Google login
- **WHEN** an approved active vendor authenticates using the linked Google identity
- **THEN** the system creates an authenticated vendor session and redirects to the vendor dashboard

#### Scenario: Pending Google login
- **WHEN** a Google identity matches a pending application
- **THEN** the system issues no JWT and displays only the waitlist state

#### Scenario: Rejected or suspended Google login
- **WHEN** a Google identity matches a rejected application or suspended account
- **THEN** the system issues no JWT and displays the corresponding non-authenticated status

### Requirement: Website login is login-only
The `/login` page SHALL contain Google login, email/password login, forgot password, and a register link, and SHALL not contain vendor application fields.

#### Scenario: Visitor opens login
- **WHEN** a visitor opens `/login`
- **THEN** the page shows only approved-vendor authentication actions and no brand or portfolio application fields

### Requirement: Admin approval is the access transition
The system SHALL grant vendor role/profile eligibility only through admin approval, an existing active vendor/admin identity, or explicit admin onboarding.

#### Scenario: Applicant before approval
- **WHEN** an applicant attempts dashboard, upload, or Shopify access before approval
- **THEN** every protected surface rejects access and no vendor JWT is minted

#### Scenario: Admin approves application
- **WHEN** an admin approves a pending application
- **THEN** application approval, invited vendor identity creation/update, Vendor profile creation, and one-time password setup token creation occur atomically without issuing a login JWT

### Requirement: Password setup and recovery are secure
The system SHALL use one canonical reset-password flow with strong password validation, hashed expiring single-use tokens, generic forgot-password responses, and no plaintext password email.

#### Scenario: Approved vendor sets password
- **WHEN** an approved vendor submits a valid password through a valid setup token
- **THEN** the system stores the password hash, clears the token, and permits subsequent email/password login

#### Scenario: Reset token reuse
- **WHEN** a consumed or expired reset token is submitted
- **THEN** the system rejects it without changing the password

### Requirement: Legacy registration routes remain safe
The system SHALL redirect `/apply` to `/register` and SHALL prevent `/signup` from acting as an independent vendor registration path.

#### Scenario: Legacy apply route
- **WHEN** a visitor opens `/apply`
- **THEN** the website redirects to `/register`
