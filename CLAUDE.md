# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DRYP is a fashion e-commerce monorepo with three main components:
- **frontend**: React Native/Expo mobile app for customers and vendors
- **backend**: Node.js/Express REST API
- **website**: Next.js marketing site and vendor admin dashboard

## Development Commands

### Backend (`/backend`)
```bash
cd backend
npm install          # Install dependencies
npm run dev          # Start with nodemon (auto-reload)
npm start            # Production start
npm run lint         # ESLint
npm test             # Run API tests
```

### Frontend (`/frontend`)
```bash
cd frontend
npm install          # Install dependencies
npx expo start       # Metro bundler (scan QR with Expo Go)
npx expo run:android # Build and run on Android
npx expo run:ios     # Build and run on iOS
npx expo start --web # Web preview
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint
```

### Website (`/website`)
```bash
cd website
npm install          # Install dependencies
npm run dev          # Dev server on localhost:3000
npm run build        # Production build
npm run lint         # ESLint
```

## Architecture

### Backend Structure
```
backend/
├── server.js              # Express app entry point, route mounting, middleware
├── src/
│   ├── config/
│   │   ├── database.js    # MongoDB connection (mongoose)
│   │   └── agenda.js      # Agenda.js scheduler for recurring jobs
│   ├── models/            # Mongoose schemas
│   │   ├── User.js        # Users with roles: user/vendor/admin
│   │   ├── Product.js     # Products with variants support
│   │   ├── Vendor.js      # Vendor profile data
│   │   ├── Order.js, Cart.js, WishlistItem.js, Like.js
│   │   └── ShopifyImport.js  # Tracks Shopify sync state
│   ├── routes/            # Express routers (REST endpoints)
│   │   ├── auth.js        # Login, register, password reset
│   │   ├── shopifyAuth.js # Shopify OAuth flow
│   │   ├── products.js    # CRUD for products
│   │   ├── vendors.js     # Vendor registration, applications
│   │   ├── orders.js, likes.js, wishlist.js, cart.js
│   │   ├── analytics/, analytics/vendor.js
│   │   └── upload.js      # S3 image uploads
│   ├── jobs/
│   │   └── shopifyImport.js  # Scheduled job to import from Shopify
│   ├── utils/
│   │   ├── shopifyOAuth.js, shopifyClient.js  # Shopify API client
│   │   ├── catalogImport.js  # Import products from Shopify
│   │   └── sendEmail.js, productMapping.js, crypto.js
│   └── middleware/
│       └── auth.js        # JWT verification middleware
```

### Frontend Structure
```
frontend/
├── app/                   # expo-router file-based routing
│   ├── (tabs)/            # Bottom tab navigator: home, search, cart, wishlist, profile
│   ├── (vendor-tabs)/      # Vendor dashboard tabs: products, orders, analytics, store
│   ├── (checkout)/        # Checkout flow screens
│   ├── account/           # User account management
│   ├── admin/             # Admin screens
│   ├── login.tsx, vendor-register.tsx, onboarding.tsx
│   └── oauth-callback.tsx # Shopify OAuth redirect handler
├── src/
│   ├── state/             # Zustand stores
│   │   ├── auth.ts        # User auth, guest mode, token management
│   │   ├── wishlist.ts, cart.ts, toast.ts
│   │   └── interactions.ts
│   ├── components/        # Reusable UI components
│   ├── lib/
│   │   ├── api.ts         # API client wrapper (fetch with auth headers)
│   │   ├── shopify.ts     # Shopify integration
│   │   └── recommender.ts # On-device product ranking
│   └── hooks/             # Custom React hooks
└── docs/
    ├── ARCHITECTURE.md    # Detailed Casa/discovery app architecture
    └── design-guidelines.md # UI style guidelines
```

### Website Structure
```
website/
├── src/app/               # Next.js App Router
│   ├── page.tsx           # Landing page
│   ├── login/, signup/    # Auth pages
│   ├── apply/             # Vendor application
│   ├── dashboard/         # Admin/vendor dashboard
│   │   ├── products/     # Product management
│   │   ├── analytics/    # Analytics view
│   │   ├── store/        # Store profile
│   │   └── catalog-import/ # Shopify catalog import UI
│   └── oauth/            # Shopify OAuth callback
├── src/components/
│   ├── ProductForm.tsx   # Add/edit product form
│   ├── ProductModal.tsx  # Product quick view
│   ├── CatalogImportPanel.tsx  # Shopify import UI
│   └── ImageCropper.tsx
└── src/contexts/
    └── AuthContext.tsx   # Next.js auth (localStorage-based)
```

## Key Patterns

### API Communication (Frontend)
All API calls go through `src/lib/api.ts` which adds JWT token from Zustand auth store:
```typescript
import { apiCall } from '@/lib/api';
const data = await apiCall('/api/products');
```

### Authentication Flow
- **Backend**: JWT tokens, bcrypt passwords, role-based access (user/vendor/admin)
- **Frontend (mobile)**: Zustand `useAuthStore` with AsyncStorage persistence; guest mode with generated `guest_id`
- **Website**: React Context with localStorage; separate session from mobile app
- **Shopify OAuth**: Full OAuth flow in both frontend and website with DRYP JWT minted on callback

### State Management (Frontend)
- Zustand stores in `frontend/src/state/`
- Auth store handles login/logout/registration and syncs wishlist on auth events
- Wishlist persists to AsyncStorage and syncs with backend on login
- Lazy requires in store actions to avoid circular dependencies

### Product Model
- Products support variants with `options` (e.g., Color, Size) and `variants` array
- External products (Shopify) tracked via `externalId` + `source` fields
- Unique index on `(vendor, externalId)` prevents duplicate imports

### File Upload
- Images uploaded directly to S3 via presigned URLs from backend
- Frontend requests presigned URL, uploads directly to S3

### Scheduled Jobs (Agenda.js)
- `shopifyImport` job runs periodically to sync Shopify catalog
- Imported products update in place (no duplicates)

## Design Guidelines (Frontend)

Header style for expo-router screens:
```typescript
headerStyle: { backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' }
headerTintColor: '#1a1a1a'
headerTitleStyle: { fontFamily: 'Zaloga', fontSize: 28 }
headerShadowVisible: false
```

## Environment Setup

### Backend (`backend/.env`)
```env
MONGO_URI=mongodb://localhost:27017/dryp
JWT_SECRET=your_secret_key
PORT=8080
AWS_REGION=us-east-1
AWS_BUCKET_NAME=your-bucket
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_PUBLIC_URL=https://your-cdn-url
SHOPIFY_API_KEY=xxx
SHOPIFY_API_SECRET=xxx
```

### Frontend (`frontend/.env`)
```env
EXPO_PUBLIC_API_BASE_URL=http://<your-local-ip>:8080
```
Use your machine's LAN IP, not `localhost` or `127.0.0.1` — mobile devices can't reach those.

### MongoDB
Local instance or MongoDB Atlas. Atlas users: whitelist your IP in Network Access.

## Important Notes

- Backend port is **8080**, not 5000 (README may reference 5000 but server.js uses 8080)
- Shopify integration uses Agenda.js for recurring imports — agenda.start() is called on server boot
- Frontend uses expo-router with file-based routing; route groups `(tabs)`, `(vendor-tabs)` don't affect URLs
- Vendor role has separate tab navigator under `app/(vendor-tabs)/`
- Website dashboard is for admins/vendors; mobile app vendor tab is for storefront management
