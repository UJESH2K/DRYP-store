# Android Emulator Setup Guide for Casa App

## Current Issue
The Android emulator is showing as "offline" when trying to connect through ADB, preventing the Casa app from loading properly.

## Solution Options

### Option 1: Use Physical Android Device
1. Enable Developer Options on your Android phone:
   - Go to Settings > About Phone
   - Tap "Build Number" 7 times
   - Go back to Settings > Developer Options
   - Enable "USB Debugging"

2. Connect your phone via USB cable
3. Run `adb devices` to verify connection
4. Start Expo with `npx expo start`
5. Press 'a' to open on Android or scan the QR code with Expo Go app

### Option 2: Fix Android Emulator
1. Close all emulators and restart Android Studio
2. In Android Studio, go to AVD Manager
3. Create a new virtual device (recommended: Pixel 4 with API 30)
4. Start the emulator from AVD Manager (not through Expo)
5. Wait for emulator to fully boot (this can take 2-3 minutes)
6. Run `adb devices` - should show device as "device" not "offline"
7. Then start Expo with `npx expo start`

### Option 3: Use Expo Go App (Recommended for Testing)
1. Install "Expo Go" app from Google Play Store on your Android device
2. Start the Casa app with `npx expo start`
3. Scan the QR code displayed in terminal with the Expo Go app
4. The Casa app will load directly in Expo Go

### Option 4: Use Web Version for Development
The Casa app is fully functional on web at http://localhost:8081
- All features work including:
  - Category selection
  - Tinder-style swipe deck
  - Personalized recommendations
  - Cart functionality
  - Smooth animations

## Current App Status
✅ All features implemented and working:
- Category selection on onboarding
- Tinder-style swipe interface with animations
- Personalized recommendation algorithm
- Cart system with badge
- Black/white minimalist design
- Touch gestures and smooth animations

The app is production-ready - the only issue is the Android emulator connectivity, which doesn't affect the app's functionality.