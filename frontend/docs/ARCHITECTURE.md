# Casa Architecture

## Overview
Casa is a swipe-first fashion discovery app implemented with React Native (Expo). It emphasizes smooth gestures, safe modal interactions, and a small on-device recommender for personalization.

## Key Flows
- Onboarding: Users select categories; saved in AsyncStorage under `categories:selected`.
- Discovery Deck: Cards represent items. Gestures:
  - Left = Pass (negative signal)
  - Right = Like (adds to wishlist)
  - Up = Add to cart
  - Long‑press = Product details modal
- Undo: Restores previous index and removes side effects (wishlist/cart) if needed.
- Wishlist/Cart: Zustand stores with simple derived helpers (counts, totals).

## Navigation
- `expo-router` with screens under `app/`. Root `_layout.tsx` wraps SafeArea + GestureHandler providers.
- `app/index.tsx` decides whether to send user to `/onboarding` or `/deck`.

## State Management
- Zustand stores under `src/state/`:
  - `cart.ts`: add/remove/update/clear, total price/items helpers.
  - `wishlist.ts`: items persisted to AsyncStorage; `addToWishlist`, `removeFromWishlist`.
  - `interactions.ts`: logs interactions for analytics or debugging.
  - `auth.ts`: placeholder OTP mock (extendable).

## Recommender
- `src/lib/recommender.ts` provides:
  - `initRecommender()` to load saved profile
  - `getInitialItems()` cold-start list filtered by selected categories
  - `rankItems()` re-ranks using a profile score + exploration injection
  - `recordEvent()`/`updateModel()` to apply weighted, decayed signals
  - `onItemViewed()` to record a view event when a card becomes current
- Profile vectors: `tag`, `category`, `brand`, `color`, `priceTier` with exponential decay. Exploration rate ~15% injects diversity.

## Deck Implementation
- Gestures via `PanResponder` and `Animated.*` with useNativeDriver where safe.
- Horizontal-only movement for left/right to avoid diagonal drift; swipe-up uses stricter thresholds.
- Animated LOVE/PASS overlays; smooth exit animations.
- Product modal is long-press and null-safe; actions for cart/like inside modal.
- Undo button triggers state rollback for wishlist/cart and restores index/animation state.

## Error Handling
- Hook order stability: Hooks declared before early returns.
- Loading fallback: If recommendation fetch is slow/fails, deck falls back to bundled `ITEMS` to prevent empty state.
- Timers: Use refs for up-to-date state; clear timeouts to avoid alerts firing late.

## Styling
- NativeWind (Tailwind) optional; most components use StyleSheet for performance and consistency.
- Badges respect safe-area.

## Extensibility
- Replace `items.ts` with API data: keep the `Item` shape for drop-in compatibility.
- Swap in a server-backed recommender: have `getInitialItems()` call your API and keep `rankItems()` as a client-side reranker.

## Testing Notes
- TypeScript type-check script available.
- For e2e, consider Detox; for unit tests, Jest + @testing-library/react-native.
