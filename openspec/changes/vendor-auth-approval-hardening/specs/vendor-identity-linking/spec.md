## ADDED Requirements

### Requirement: Verified Google identity is authoritative
The system SHALL derive Google email and subject ID only from the verified OAuth response and SHALL never treat client-supplied `googleEmail` as proof of identity ownership.

#### Scenario: Client supplies a different Google email
- **WHEN** an application request includes a Google email that was not established by the verified OAuth flow
- **THEN** the system ignores or rejects that identity claim

### Requirement: Google identities map deterministically
The system SHALL prefer verified Google subject ID, then a unique normalized Google email, when resolving an application or user and SHALL fail closed when more than one record matches.

#### Scenario: Subject ID match
- **WHEN** a verified Google subject ID is already linked to one application or user
- **THEN** the system resolves exactly that identity regardless of editable profile fields

#### Scenario: Ambiguous email match
- **WHEN** a normalized Google email collides with multiple contact or Google-email records
- **THEN** the system grants no access and records a safe collision error for administrative resolution

### Requirement: Identity uniqueness is enforced safely
The system SHALL prevent duplicate Google subject IDs, duplicate verified Google emails, and contact-email/Google-email cross-field collisions.

#### Scenario: Duplicate Google application
- **WHEN** concurrent requests attempt to create applications for the same verified Google identity
- **THEN** at most one pending application is created and all other requests receive a generic non-enumerating result

#### Scenario: Existing data migration
- **WHEN** uniqueness constraints are prepared for deployment
- **THEN** a migration audit reports all existing duplicates or cross-field collisions before indexes are enabled

### Requirement: Approved contact and Google identities share one vendor account
The system SHALL attach an approved application's verified Google identity to the canonical invited/vendor User and Vendor profile instead of creating duplicate accounts.

#### Scenario: Contact email differs from Google email
- **WHEN** an approved application has one contact email and a different verified Google email
- **THEN** Google login links to the canonical approved User and existing Vendor profile and does not create a second User or Vendor

### Requirement: Vendor creation routes share the approval policy
The system SHALL apply the same approval policy to Google, email/password, Shopify, and other vendor creation/authentication entry points unless explicit admin onboarding is used.

#### Scenario: Anonymous Shopify onboarding without approval
- **WHEN** an anonymous Shopify callback has no approved application and no existing active vendor/admin session
- **THEN** the system creates no vendor account and redirects to registration or waitlist according to policy
