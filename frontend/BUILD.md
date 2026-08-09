# DRYP Mobile — Build Instructions

## Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g eas-cli`)
- EAS account (sign up at https://expo.dev)
- EAS project configured (`eas.json` present in `frontend/`)

## Environment Variables

Required in `frontend/.env` (and configured in EAS Secrets for cloud builds):

- `EXPO_PUBLIC_API_BASE_URL` — backend URL (e.g. `https://api.dryp.store`)
- `EXPO_PUBLIC_RAZORPAY_KEY` — Razorpay publishable key

## Local Development

```bash
cd frontend
npx expo start              # Metro bundler
npx expo run:android        # Build + run on connected Android device/emulator
npx expo run:ios            # Build + run on iOS simulator (macOS only)
npx expo start --web        # Web preview
```

## Production Builds (EAS)

### Android APK (preview / internal testing)

```bash
cd frontend
eas build --platform android --profile preview --local
```

Use `--local` to build on your machine (requires Android SDK). Omit it for EAS cloud build.

### iOS IPA (App Store submission)

```bash
cd frontend
eas build --platform ios --profile production
```

EAS cloud build only (requires Apple Developer account + provisioning profile configured in `eas.json`).

## EAS Profiles

Defined in `frontend/eas.json`:
- `preview` — internal testing builds (APK for Android, development IPA for iOS)
- `production` — App Store / Play Store release builds
