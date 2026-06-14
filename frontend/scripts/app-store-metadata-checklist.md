# App Store Connect Metadata Checklist

Run from `/Users/dan/Desktop/x/DRYP-store/frontend/`.

## Screenshots

### Required: 3 sizes (6.5", 5.5", 12.9")
Use: `eas build --profile preview --platform ios` + run on simulator
- Portrait only (landscape not supported for social apps anymore)
- No text overlays, no UI mockup, real app UI only
- Consistent branding
- Include OS status bar and home indicator

| Size | Resolution | Notes |
|---|---|---|
| iPhone 15 Pro Max | 1290x2796 | 6.7" — primary screenshot in App Store |
| iPhone 14 | 1170x2532 | 6.1" — standard view |
| iPad Pro (12.9") | 2048x2732 | 12.9" — shown on iPad in App Store |

Command to screenshot simulator:
```bash
# Run build, start Expo, run on simulator, then:
xcrun simctl io booted screenshot -f ~/Downloads/screenshot.png
```

### Default screenshot template
Template: iOS default screenshot + centered app window

## App Information

### App Store Connect (appconnect.apple.com → My Apps → DRYP)

- **App Name**: DRYP
- **Subtitle**: Your Style, Your Store
- **Primary Category**: Shopping
- **Secondary Category**: Fashion
- **Privacy Policy**: https://your-domain.com/privacy
- **Support URL**: https://your-domain.com/contact
- **Marketing Website**: https://your-domain.com (if separate)

### Description

Use new Markdown formatting for better localization support.

```
# Your Style, Your Store.

DRYP is your personal shopping assistant. Swipe right to save, swipe left to pass. See products that actually match your taste, brought to you by your favorite independent designers.

## Why DRYP?

- **Personalized feed**: See products you’ll actually love, not just random listings.
- **Swipe-to-shop**: Quick and intuitive — swipe right to save, up to add to cart.
- **Independent designers**: Shop from curated boutiques and unique brands.
- **Private**: No ads, no tracking, just a clean shopping experience.

## Privacy-first

We never sell or share your data. Your shopping history belongs to you.

---
DRYP is a platform for independent fashion designers to showcase and sell their work.
```

### Localizations

English (en) is required. Add more locales as needed:
- 🇺🇸 English (en) — primary
- 🇮🇳 Hindi (hi)
- 🇪🇸 Spanish (es)
- 🇫🇷 French (fr)
- 🇩🇪 German (de)

### Keywords

max 100 chars (spaces count):
```
shopping, fashion, boutique, indie fashion, clothing, accessories, swipe shop, curated, personalized recommendations, sustainable fashion, local designers
```

### App Privacy

Answer: **No** to "Do you or your third-party partners collect any of the following data types from this app?"

- Name or contact info
- User content
- Search history
- Browsing history
- Location
- Health
- Financial info
- Contacts
- Photos
- Music & audio
- Files & documents
- Activity
- Advertising data
- Diagnostics
- Usage data
- Purchases
- Location & activity
- Contacts
- Photos
- Audio files
- Files
- Health & fitness
- Medical
- Financial info
- Search history

### App Store Review Notes

```
The app is fully functional and ready for review.
- User accounts and login work.
- Swipe-based product discovery works.
- Wishlist and cart are implemented.
- Vendor portal is accessible.
- TestFlight internal beta is live.
No new SDKs are used. No sign-in with Apple.
```

### Version Release

1. Build with `eas build --profile production --platform ios`
2. EAS should auto-increment build number
3. Fill in "What's New" with:
   ```
   - Initial release
   - Personalized shopping experience with swipe discovery
   - Integrated payment via vendor partners
   - Vendor portal for designers and boutiques
   ```
4. Submit to App Store for review

### Assets

#### App Icon (1024x1024 PNG, no alpha)
Generate via frontend/scripts/generate-app-icon.mjs
- Design asset: replace with real brand asset
- Contrast: white-on-white will be rejected

### Fastlane / Manual Checklist

| Step | Status | Notes |
|---|---|---|
| [ ] Screenshots ready | | 3 sizes saved in App Store Connect |
| [ ] Privacy policy written | | URL on file at https://your-domain.com/privacy |
| [ ] App name + subtitle set | | Shopping + Your Style, Your Store |
| [ ] Categories selected | | Shopping / Fashion |
| [ ] Localization filled | | At least English, preferred Hindi/ES/FR/DE |
| [ ] Keywords set | | "shopping, fashion, boutique, ..." |
| [ ] App Privacy questionnaire done | | No data collected |
| [ ] Support URL available | | https://your-domain.com/contact |
| [ ] Sign-in with Apple NOT enabled | | Manual sign-in only |
| [ ] TestFlight build | | Internal testers approved |
| [ ] Release notes ready | | "Initial release..." |
