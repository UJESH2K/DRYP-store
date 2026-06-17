# iOS Build & Submit Runbook

A step-by-step guide for taking the DRYP Expo app from "compiles on Android"
to "live on the App Store". This document is the missing piece between
`app.config.ts` (already configured) and a working iOS install.

You will need:

- A Mac with macOS 13+ (Ventura or newer)
- Xcode 15+ installed (App Store → search "Xcode")
- Node 20+ and `npm` 10+
- An Apple Developer account ($99/yr, https://developer.apple.com/programs)
- An Expo account (free, https://expo.dev/signup)
- The EAS CLI: `npm install -g eas-cli`

This runbook assumes you have already shipped the Android app and the
backend is live on AWS. If you haven't, start with `docs/ROADMAP.md`.

---

## 1. One-time setup

### 1.1 Apple Developer account → App Store Connect

1. Sign in to https://appstoreconnect.apple.com
2. **My Apps → + → New App**:
   - Platform: iOS
   - Name: **DRYP**
   - Primary Language: English
   - Bundle ID: **`com.dryp.app`**
     - This must match `ios.bundleIdentifier` in `app.config.ts`.
     - If you need a different bundle id, edit `app.config.ts` and
       regenerate a new app in App Store Connect to match.
   - SKU: any string, e.g. `dryp-ios-001`
3. Note your **Apple Team ID** (a 10-character alphanumeric string).
   Find it at: App Store Connect → top right → account name → "View
   Apple ID" → scroll down → "Team ID". Or: developer.apple.com →
   Membership → Team ID.

### 1.2 Update eas.json

Open `frontend/eas.json` and replace the placeholder:

```json
"appleTeamId": "REPLACE_WITH_YOUR_10_CHAR_APPLE_TEAM_ID"
```

with your actual team id (e.g. `"appleTeamId": "ABCDE12345"`).

Also confirm `submit.production.ios.ascAppIdentifier` is `com.dryp.app`.
This must match the bundle id of the app you created in step 1.1.

### 1.3 Expo account

1. `eas login` — opens a browser, sign in with your Expo account.
2. Link the project to the Expo organization you want it under:
   - `eas init` — only if the `extra.eas.projectId` is missing. It
     currently points to a specific project; if that's not yours, see
     "Moving the project to your Expo org" below.

### 1.4 EAS Secrets

The frontend reads `EXPO_PUBLIC_API_BASE_URL` at bundle time. For
production builds, set it as an EAS Secret so it's available during
EAS build but not committed to git.

```sh
cd frontend
eas env:create --name EXPO_PUBLIC_API_BASE_URL \
               --value "https://api.your-dryp-backend.com" \
               --environment production --type string
```

Repeat with `--environment preview` and `--environment development`
for those profiles. The dev profile can also use a local tunnel
(ngrok, Cloudflare Tunnel) if you're testing against a dev backend.

Verify: `eas env:list` should show three entries.

---

## 2. First iOS build (internal TestFlight / preview)

### 2.1 Build

```sh
cd frontend
eas build --platform ios --profile preview
```

First build takes 10–20 minutes. EAS will:

1. Run `pod install` (no Mac needed — EAS has macOS workers).
2. Compile the native iOS app and submit it for code signing.

### 2.2 Code signing

EAS will prompt for credentials on the first build. Recommended: let
EAS manage your certificates.

1. **Generate App Store Connect API Key** (one-time, in App Store
   Connect → Users and Access → Keys → App Store Connect API):
   - Name: `EAS Build`
   - Access: **App Manager**
   - Download the `.p8` file. Note the **Issuer ID** and **Key ID**.
2. When `eas build` asks for credentials, choose
   "**Set up credentials interactively**" and provide:
   - Apple ID (your developer account email)
   - App-specific password (https://appleid.apple.com → App-Specific
     Passwords → Generate)
   - Or, if you have the .p8 already: provide the Issuer ID and Key
     ID and the path to the `.p8` file. This is the better path —
     avoids password prompts on every build.

If you have an existing distribution certificate, EAS will import
it. Otherwise it generates one and stores it in EAS Build Service.

### 2.3 Wait for the build to finish

```sh
eas build:list --platform ios --status finished --limit 1
```

When finished, download the `.ipa`:

```sh
eas build:view --latest
```

This prints a download URL. Open it on a Mac with Xcode → Devices and
Simulators → drag the `.ipa` onto the device, or use Transporter.app
to upload to App Store Connect.

### 2.4 Add to TestFlight

1. In App Store Connect → My Apps → DRYP → TestFlight tab.
2. The new build will appear under "iOS Builds" within ~5 minutes.
3. Add internal testers: TestFlight tab → Internal Testing → + Add
   tester. Internal testers don't need App Store review.

TestFlight install: testers install the TestFlight app, accept the
invite, and install the DRYP build from within it.

---

## 3. Production build & App Store submission

### 3.1 Pre-submission checklist

- [ ] App icon: 1024x1024, no transparency, no rounded corners. Apple
      will round them automatically. Place at
      `frontend/assets/icon.png` (already referenced by `app.config.ts`).
- [ ] Splash screen: 1242x2436 (iPhone X). Already at
      `frontend/assets/splash.png`.
- [ ] Privacy manifest: `expo-build-properties` plugin handles it.
      No tracking, so the default empty manifest is correct.
- [ ] App Privacy questions in App Store Connect (see Appendix A below).
- [ ] Screenshots (6.5", 5.5", 12.9" iPad Pro) — see Appendix B.
- [ ] App description, keywords, support URL, marketing URL.

### 3.2 Bump the build number

`app.config.ts` has `ios.buildNumber: "1"`. For each App Store
submission, bump it (EAS does this automatically when
`autoIncrement: true` is set on the `production` profile).

To bump manually:

```sh
# Get current build number
eas build:list --platform ios --status finished --limit 1
# Or just edit ios.buildNumber in app.config.ts
```

### 3.3 Build for the App Store

```sh
cd frontend
eas build --platform ios --profile production
```

This takes 15–30 minutes. The output `.ipa` is automatically uploaded
to App Store Connect — no manual step needed if you provided API key
credentials (see 2.2).

### 3.4 Submit for review

Option A: CLI

```sh
cd frontend
eas submit --platform ios --profile production --latest
```

The CLI reads the App Store Connect API key from EAS and submits
the build. You'll see "Waiting for review" within a few minutes.

Option B: App Store Connect web UI

1. App Store Connect → My Apps → DRYP → + Version.
2. Select the build from the iOS Builds list.
3. Fill in the metadata, screenshots, and privacy answers.
4. Submit for review.

### 3.5 Review

Apple's first review takes 24–48 hours. Subsequent updates are
usually <24 hours. Rejections come with a reason — common ones for
a new app:

- "Guideline 2.1 - Performance - App Completeness": missing
  functionality, broken links, or login that doesn't work for the
  reviewer's account. **Make sure the reviewer can sign in.** The
  test account should be a vendor (since the mobile app is a
  shopper app but the website is the vendor portal).
- "Guideline 5.1.1 - Privacy": missing privacy policy URL. Add one
  in App Store Connect → App Privacy.
- "Guideline 2.3 - Accurate Metadata": screenshots that don't match
  the actual app.

If rejected, address the issue, bump `buildNumber`, rebuild, and
re-submit.

---

## 4. Updating the app

```sh
# Make your code changes
cd frontend
# Bump version in app.config.ts (e.g. version: "1.0.1")
# Bump ios.buildNumber and android.versionCode
eas build --platform ios --profile production
eas submit --platform ios --profile production --latest
```

EAS Submit will fail if the build number isn't incremented. To
auto-increment on each build, set `autoIncrement: true` in
`eas.json` (already done for the `production` profile).

---

## 5. Common errors and fixes

### "Provisioning profile doesn't include the Push Notifications
entitlement"

You don't use push notifications, so this shouldn't appear. If it
does, regenerate the profile in the Apple Developer portal: Certificates,
Identifiers & Profiles → Profiles → your distribution profile →
Regenerate.

### "Bundle identifier already in use"

Two apps in App Store Connect with the same bundle id. Either delete
the duplicate or pick a different bundle id and update `app.config.ts`.

### "Your team does not have a device registered for this bundle id"

For internal device testing (not TestFlight): register the device's
UDID in the Apple Developer portal. For TestFlight distribution, this
isn't needed.

### "EAS build failed: ENOENT: no such file or directory, 'ios/'"

Run `npx expo prebuild` to generate the native `ios/` directory. EAS
will run this automatically on the first build, but if you've cleared
caches or moved files, you may need to run it locally.

### "Authentication with Apple Developer Portal failed"

Either your Apple ID password is wrong, or your account doesn't have
the right role. In App Store Connect → Users and Access → your user →
make sure "App Manager" or "Admin" is checked.

### "There is no SDK with the name or path 'something-iOS'"

The dependency has a native module that doesn't support iOS yet.
Either find an iOS-compatible alternative or `expo prebuild` and
patch the Podfile. Common offenders: ml models, custom camera
filters. DRYP doesn't use any of these.

---

## 6. Moving the project to your Expo org (only if needed)

The `extra.eas.projectId` in `app.config.ts` currently points to a
specific EAS project. If you want to use a different EAS org:

1. `eas init --force` — re-initializes with your org.
2. The new project id is written back to `app.config.ts`.
3. Verify the bundle id in App Store Connect still matches the new
   project's bundle id.

This is destructive: existing EAS builds for the old project are
not migrated.

---

## Appendix A: App Privacy answers

When you first submit, App Store Connect walks you through privacy
questions. The DRYP mobile app collects:

- **Contact Info → Email Address** (used for sign-in)
- **Contact Info → Name** (used for shipping and personalization)
- **User Content → Photos or Videos** (uploaded by vendors only;
  shoppers don't upload images)
- **Purchases → Purchase History** (for order management)
- **Usage Data → Product Interaction** (likes, views, swipes — for
  the recommender)
- **Diagnostics → Crash Data** (only if you wire up Sentry; see
  Phase 0D in the roadmap)

All data is "**Linked to User Identity**" (we have a login). Set
"Used for Tracking" to **No** for all of them — we don't share
data with ad networks.

The privacy policy URL must be a real, accessible page. Host on the
website (`/privacy`) before submitting.

## Appendix B: Required screenshots

For iPhone 6.7" (the default on App Store Connect), upload 1242x2688
or 1290x2796 PNG/JPG. You need at least 3, but 5-7 is better.

Recommended screens to capture:

1. Onboarding (category selection)
2. Home feed (swipe stack)
3. Product detail
4. Cart
5. Wishlist
6. Profile

The 12.9" iPad Pro screenshots are required only if you support
iPad. Currently `ios.supportsTablet: true`, so capture at least one.
2688x1242 (landscape) or 1242x2688 (portrait).

Generate screenshots by running the app in the iOS Simulator:

```sh
eas build --platform ios --profile development  # OR
eas build --platform ios --profile preview
# Then: eas build:view --latest, download, open in Xcode simulator
```

Or for fast iteration, run the iOS Simulator locally (Mac only):
`npx expo run:ios`.

## Appendix C: Updating credentials

If your App Store Connect API key rotates:

1. Generate a new `.p8` in App Store Connect.
2. `eas credentials` → manage App Store Connect API key → upload new.
3. Rebuild. EAS will use the new key.

If you lose access to your Apple account entirely, contact Apple
Developer Support. Recovery typically takes 2-5 business days.

---

## Quick reference

```sh
# Local dev (Expo Go or simulator)
cd frontend && npx expo start

# Local iOS simulator build (Mac only)
cd frontend && npx expo run:ios

# EAS build for a specific profile
eas build --platform ios --profile development  # dev client
eas build --platform ios --profile preview       # internal TestFlight
eas build --platform ios --profile production    # App Store

# EAS submit
eas submit --platform ios --profile production --latest

# View current builds
eas build:list --platform ios

# Manage EAS env / secrets
eas env:list
eas env:create --name FOO --value "bar" --environment production
```

When the build fails, `eas build:view <build-id>` shows the full
build log. The most useful section is the **Build** phase, which
shows the iOS compile output. `npx expo prebuild` can often catch
issues locally before paying for a remote build.
