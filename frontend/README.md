# Casa

*A swipe-first fashion discovery app built with React Native and Expo.*

[![Made with Expo](https://img.shields.io/badge/Made%20with%20Expo-000020.svg?style=for-the-badge&logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![NativeWind](https://img.shields.io/badge/NativeWind-38BDF8?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://www.nativewind.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Casa is a mobile app prototype for discovering fashion. Swipe right to like, left to pass, and up to add to your cart. It features an on-device recommender that personalizes your feed based on your interactions.

---

## ✨ Features

- **Swipe-based Discovery:** Intuitive gesture-based interface (like, pass, add-to-cart).
- **Product Details:** Long-press any item to view details, select sizes/colors, and take quick actions.
- **Persistent State:** Wishlist and Cart are saved across sessions using Zustand and AsyncStorage.
- **Personalized Feed:** A simple on-device recommender tailors the item feed to your tastes.
- **Onboarding:** A quick setup to select your favorite categories.

---

## 🚀 Getting Started

### Prerequisites

- Node.js (LTS version recommended)
- Expo Go app on your iOS or Android device.

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd Casa_App
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Start the development server:**
    ```bash
    npm run start
    ```

4.  **Run the app:**
    - Scan the QR code with the Expo Go app on your phone.
    - Or, run on a simulator by pressing `i` for iOS or `a` for Android in the terminal.

---

## 🕹️ How to Use

- **Onboarding:** On your first launch, pick your favorite categories to personalize your feed.
- **Gestures:**
    - **Swipe Right:** Like an item (adds to Wishlist).
    - **Swipe Left:** Pass on an item.
    - **Swipe Up:** Add an item directly to your Cart.
    - **Long Press:** Open the product details view.
- **Undo:** Made a mistake? Tap the "Undo" button after any action.
- **Preferences:** Tap the "Prefs" button in the header to change your category preferences at any time.

---

## 🎨 App Wireframe

```
┌─────────────────────────────────────┐
│              Casa App               │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────────┐ │
│  │         Onboarding              │ │
│  │    Select Categories            │ │
│  │   [Fashion] [Shoes] [Bags]      │ │
│  └─────────────────────────────────┘ │
│                 ↓                   │
│  ┌─────────────────────────────────┐ │
│  │        Main Feed (Deck)         │ │
│  │                                 │ │
│  │    ┌─────────────────────┐      │ │
│  │    │   Product Card      │      │ │
│  │    │   [Product Image]   │      │ │
│  │    │   Product Name      │      │ │
│  │    │   $Price            │      │ │
│  │    └─────────────────────┘      │ │
│  │                                 │ │
│  │  ← Swipe Left (Pass)            │ │
│  │  → Swipe Right (Like/Wishlist)  │ │
│  │  ↑ Swipe Up (Add to Cart)       │ │
│  │  Long Press → Product Details   │ │
│  │                                 │ │
│  │  [Undo] [Prefs] [Cart] [♡]      │ │
│  └─────────────────────────────────┘ │
│                 ↓                   │
│  ┌─────────────────────────────────┐ │
│  │      Product Details            │ │
│  │   [Large Product Image]         │ │
│  │   Product Description           │ │
│  │   Size: [S] [M] [L] [XL]        │ │
│  │   Color: [●] [●] [●]            │ │
│  │   [Add to Cart] [Add to ♡]      │ │
│  └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘

Data Flow:
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   Static    │───▶│ Recommender  │───▶│    Feed     │
│   Products  │    │   Engine     │    │  (Zustand)  │
└─────────────┘    └──────────────┘    └─────────────┘
                           ▲                   │
                           │                   ▼
                   ┌──────────────┐    ┌─────────────┐
                   │ User Actions │    │ Persistent  │
                   │ (Swipes)     │    │ Storage     │
                   └──────────────┘    └─────────────┘
```

---

## 📂 Project Structure

The project is organized with a feature-first approach using Expo Router.

```
/
├── app/              # All app screens and routes
├── src/              # Core logic, components, and state
│   ├── components/   # Reusable UI components
│   ├── data/         # Static data (items, categories)
│   ├── lib/          # Helper functions (recommender)
│   └── state/        # Global state management (Zustand)
├── assets/           # (Not used in this version)
└── docs/             # Detailed architecture documents
```
For a more detailed breakdown, see `docs/ARCHITECTURE.md`.

---

## ⚙️ Available Scripts

- `npm run start`: Starts the Expo development server.
- `npm run android`: Builds and runs the app on a connected Android device or emulator.
- `npm run ios`: Builds and runs the app on the iOS simulator (macOS only).
- `npm run web`: Runs the app in a web browser.
- `npm run typecheck`: Runs the TypeScript compiler to check for type errors.

---

## License

This is an internal, proprietary project.
