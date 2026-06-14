# EAS iOS Runbook

The exact, copy-paste sequence to get the DRYP iOS app from "this repo" to a
TestFlight build. Run from a macOS or Linux machine (a Mac is **not** required
for cloud builds, only for the iOS simulator).

## One-time setup

1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   ```
2. Log in to your Expo account (the one that owns project
   `98b13c46-4429-4145-8db9-1ea1ee234685`):
   ```bash
   eas login
   ```
3. Tell EAS who you are on Apple. It opens a browser; sign in with the Apple
   ID that owns the DRYP Developer account. **App Store Connect → Users and
   Access → Integrations → Expo** must be added.
   ```bash
   eas credentials
   ```
4. Add the backend URL as an EAS secret (do **not** commit it):
   ```bash
   eas env:create --name EXPO_PUBLIC_API_BASE_URL --value https://api.your-domain.com --environment production --visibility secret
   eas env:create --name EXPO_PUBLIC_API_BASE_URL --value http://192.168.1.9:8080 --environment development --visibility secret
   ```
   (Replace the LAN IP with your laptop's actual one — `ipconfig getifaddr en0`
   on macOS.)

## First dev build (cloud-built .ipa, install on a real iPhone)

```bash
cd frontend
eas build --profile development --platform ios
```

EAS prints a `.ipa` URL. Email it to yourself, tap it on the iPhone with
TestFlight installed. The dev client launches and Metro can connect.

To run the JS:
```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.9:8080 npx expo start --dev-client
```

The dev client scans the QR and pulls the latest JS from Metro.

## Preview build (TestFlight internal)

```bash
eas build --profile preview --platform ios
```

When the build finishes:
```bash
eas submit --platform ios --latest
```

TestFlight → Internal Testing → invite testers by email.

## Production build (App Store submission)

Only do this once App Store Connect metadata is filled in (screenshots,
description, App Privacy questionnaire, support URL, privacy URL).

```bash
eas build --profile production --platform ios
eas submit --platform ios --latest
```

`autoIncrement: true` in `eas.json` bumps the build number for you.

## Common gotchas

- **`eas.json` `appVersionSource: "remote"`** means the App Store / TestFlight
  version comes from the build, not the local `package.json`. For dev builds
  this is fine.
- **Code signing**: EAS manages your certs once you accept the prompt. You
  never need to open Keychain Access.
- **Apple rejection cycle**: count on one round of metadata rejection (icon
  contrast, missing privacy URL, screenshot dimensions). Plan a 1-week
  buffer.
- **App Privacy questionnaire**: you use no tracking SDKs, so the answer to
  "Do you or your third-party partners collect data from this app?" is **No**
  for every row.

## Branching & tags

Tag each TestFlight build in git so you can roll back:
```bash
git tag v0.1.0-ios-tf1
git push --tags
```
