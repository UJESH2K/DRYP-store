# Zaloga AI Stylist — Complete UI Mockup

> MD-format wireframe showing current state vs planned state.

---

## 1. CURRENT UI STATE (What exists today)

### 1.1 Main Tab Layout (5 tabs)

```
┌──────────────────────────────────────────┐
│  Status Bar                      🔋 94%  │
├──────────────────────────────────────────┤
│  ┌────────────────────────────────────┐   │
│  │  DRYP                    ❤️  🔔    │   │  ← Header (Zaloga 28px)
│  └────────────────────────────────────┘   │
│  ┌──────┐ ┌──────┐ ┌──────┐              │
│  │Brands│ │Categ.│ │Colors│              │  ← Filter row (MultiSelectDropdown)
│  └──────┘ └──────┘ └──────┘              │
│                                           │
│          ┌──────────────────┐             │
│          │                  │             │
│          │   Product Card   │             │  ← Swipeable card deck
│          │   [Image]        │             │
│          │   Name           │             │
│          │   $Price         │             │
│          │                  │             │
│          └──────────────────┘             │
│                                           │
│              [  Undo  ]                   │  ← Undo button (3s window)
│                                           │
│  ┌────────┬────────┬────────┬────────┬──┐ │
│  │ 🏠    │ 🔍    │ 🔖    │ 🛒   │ 👤│ │  ← Tab bar (5 tabs)
│  │ Home  │ Search │ Wish   │ Cart  │Pro│ │    Zaloga 12px labels
│  └────────┴────────┴────────┴────────┴──┘ │
└──────────────────────────────────────────┘
```

**Tab bar width distribution (at 375px screen):**
| Tab | Width | Label |
|-----|-------|-------|
| Home | ~75px | 🏠 Home |
| Search | ~75px | 🔍 Search |
| Wishlist | ~75px | 🔖 Wishlist |
| Cart | ~75px | 🛒 Cart |
| Profile | ~75px | 👤 Profile |

**Current concerns:** Bottom bar is at full capacity. Each tab gets ~75px — tight on smaller screens like iPhone SE (320px). Adding a 6th tab is not viable.

---

## 2. PLANNED UI WITH ZALOGA

### 2.1 Home Screen — Floating Action Button (FAB)

```
┌──────────────────────────────────────────┐
│  Status Bar                      🔋 94%  │
├──────────────────────────────────────────┤
│  ┌────────────────────────────────────┐   │
│  │  DRYP                    ❤️  🔔    │   │  ← Header (UNCHANGED)
│  └────────────────────────────────────┘   │
│  ┌──────┐ ┌──────┐ ┌──────┐              │
│  │Brands│ │Categ.│ │Colors│              │  ← Filters (UNCHANGED)
│  └──────┘ └──────┘ └──────┘              │
│                                           │
│          ┌──────────────────┐             │
│          │                  │             │
│          │   Product Card   │             │  ← Swipeable deck (UNCHANGED)
│          │    [Image]       │             │
│          │                  │             │
│          └──────────────────┘             │
│                                           │
│              [  Undo  ]                   │  ← Undo (UNCHANGED)
│                                           │
│  ┌────────┬────────┬────────┬────────┬──┐ │
│  │ 🏠    │ 🔍    │ 🔖    │ 🛒   │ 👤│ │  ← Tab bar (UNCHANGED)
│  │ Home  │ Search │ Wish   │ Cart  │Pro│ │
│  └────────┴────────┴────────┴────────┴──┘ │
│         ✦                                 │  ← ZALOGA FAB (NEW)
│     (pulsing orb above tab bar)           │    absolute, bottom: 70, centered
└──────────────────────────────────────────┘
```

**FAB specs:**
- Position: `position: absolute`, `bottom: 70`, `alignSelf: center`
- Size: 52×52px circle
- Background: gradient (#000 → #333) or brand color
- Shadow: subtle elevation for depth
- Animation: gentle pulse (scale: 1 → 1.05 → 1, 2s loop)
- Icon: sparkle ✦ or "Z" in Zaloga font
- Safe area: aware of iPhone home indicator

---

### 2.2 Zaloga Bottom Sheet — Open State (50% snap)

```
┌──────────────────────────────────────────┐
│  ┌────────────────────────────────────┐   │
│  │  ═══════════  (drag handle)        │   │  ← Sheet handle bar
│  │  ✦ ZALOGA                    ✕    │   │  ← Header: title + close
│  ├────────────────────────────────────┤   │
│  │                                    │   │
│  │  ┌──────────────────────────┐      │   │
│  │  │  Hi! I'm Zaloga, your    │      │   │
│  │  │  personal stylist.       │      │   │  ← AI greeting message
│  │  │  What are you looking    │      │   │
│  │  │  for today?              │      │   │
│  │  └──────────────────────────┘      │   │
│  │                                    │   │
│  │  ┌──────────────────────────┐      │   │
│  │  │ Try:                     │      │   │
│  │  │ "Date night outfit"     │      │   │  ← Suggested prompts (chips)
│  │  │ "Something in green"    │      │   │
│  │  │ "What matches this?"    │      │   │
│  │  └──────────────────────────┘      │   │
│  │                                    │   │
│  │  ┌───────────┐ ┌────────────────┐  │   │
│  │  │  📷       │ │  Type a message│➤ │   │  ← Chat input bar
│  │  └───────────┘ └────────────────┘  │   │
│  ├────────────────────────────────────┤   │
│                           (50% height)    │
└──────────────────────────────────────────┘
```

---

### 2.3 Zaloga Bottom Sheet — Full State (90% snap, after conversation)

```
┌──────────────────────────────────────────┐
│  ┌────────────────────────────────────┐   │
│  │  ═══════════                       │   │
│  │  ✦ ZALOGA                    ✕    │   │
│  ├────────────────────────────────────┤   │
│  │                                    │   │
│  │  ┌──────────────────────────┐      │   │
│  │  │  Hi! I'm Zaloga...       │      │   │  ← AI message
│  │  └──────────────────────────┘      │   │
│  │                                    │   │
│  │  ┌──────────────────────────┐      │   │
│  │  │ I'm looking for a summer │      │   │  ← User message (right aligned)
│  │  │ outfit for a beach party │      │   │
│  │  └──────────────────────────┘      │   │
│  │                                    │   │
│  │  ┌──────────────────────────┐      │   │
│  │  │ Great choice! Here are   │      │   │
│  │  │ some summer-ready pieces │      │   │  ← AI response with 
│  │  │ that would work:         │      │   │    embedded product cards
│  │  │                          │      │   │
│  │  │  ┌──────┐ ┌──────┐      │      │   │
│  │  │  │Item 1│ │Item 2│      │      │   │
│  │  │  │📷    │ │📷    │      │      │   │  ← Product recommendation
│  │  │  │Name  │ │Name  │      │      │   │    cards (horizontal scroll)
│  │  │  │$Price│ │$Price│      │      │   │
│  │  │  └──────┘ └──────┘      │      │   │
│  │  └──────────────────────────┘      │   │
│  │                                    │   │
│  │  ┌──────────────────────────┐      │   │
│  │  │ Love the linen shirt!    │      │   │  ← User follow-up
│  │  │ What shoes go with it?   │      │   │
│  │  └──────────────────────────┘      │   │
│  │                                    │   │
│  │  ┌──────────────────────────┐      │   │
│  │  │ For that linen shirt,    │      │   │
│  │  │ these espadrilles would  │      │   │  ← AI response with
│  │  │ complete the look...     │      │   │    more product recs
│  │  │  ┌──────┐ ┌──────┐      │      │   │
│  │  │  │Shoe 1│ │Shoe 2│      │      │   │
│  │  │  │📷    │ │📷    │      │      │   │
│  │  │  └──────┘ └──────┘      │      │   │
│  │  └──────────────────────────┘      │   │
│  │                                    │   │
│  │  ┌───────────┐ ┌────────────────┐  │   │
│  │  │  📷       │ │ Type a message │➤ │   │  ← Chat input
│  │  └───────────┘ └────────────────┘  │   │
│  ├────────────────────────────────────┤   │
│                           (90% height)    │
└──────────────────────────────────────────┘
```

---

## 3. COMPONENT ARCHITECTURE

### 3.1 Frontend Component Tree

```
app/
├── (tabs)/
│   └── home.tsx                    ← ZALOGA FAB RENDERED HERE
│       └── Header.tsx
│       └── Filters.tsx
│       └── Card.tsx (swipeable)
│       └── ProductDetailModal.tsx
│       └── ⚡ ZalogaFAB.tsx         ← NEW: floating orb
│       └── ⚡ ZalogaSheet.tsx       ← NEW: bottom sheet (rendered at app root)

src/
└── components/
    └── stylist/                      ← NEW: all Zaloga components
        ├── ZalogaFAB.tsx             — floating orb + animation
        ├── ZalogaSheet.tsx           — @gorhom/bottom-sheet wrapper
        ├── ChatBubble.tsx            — user + AI message variants
        ├── ProductCard.tsx           — mini product card for recs
        ├── ChatInput.tsx             — text input + image picker + send
        ├── SuggestedPrompts.tsx      — tapable prompt chips
        └── ImagePreview.tsx          — attached image preview in chat
```

### 3.2 Backend Architecture

```
backend/
├── src/
│   ├── models/
│   │   ├── StylistConversation.js    ← NEW: conversation + messages
│   │   └── Product.js                ← MODIFIED: +embedding field
│   ├── routes/
│   │   ├── stylist.js                ← NEW: POST /api/stylist/chat, GET /api/stylist/history
│   │   └── upload.js                 ← MODIFIED: relaxed vendor check
│   ├── services/
│   │   ├── stylist.js                ← NEW: OpenAI + RAG pipeline
│   │   └── styleProfile.js           ← NEW: user style aggregation
│   ├── jobs/
│   │   └── embedProducts.js          ← NEW (deferred): Agenda job for embeddings
│   └── middleware/
│       └── auth.js                   ← UNCHANGED
└── server.js                         ← MODIFIED: mount stylist routes
```

---

## 4. USER FLOW — COMPLETE EXPERIENCE

### Flow A: First-time user opens Zaloga

```
1. User sees ✦ orb pulsing above tab bar
2. Tap orb → sheet slides up (50%)
3. Zaloga greets: "Hi! I'm Zaloga. I see you're new — what's your style?"
4. Suggested prompts appear as chips (tappable)
5. User taps "Casual streetwear" chip
6. Sheet expands to full (90%)
7. Zaloga replies with 3 product recommendations from catalog
8. User taps one → navigates to ProductDetailModal
9. User swipes right → adds to Likes
10. Zaloga learns: "Noted you liked this bomber jacket!"
```

### Flow B: Returning user with swipe history

```
1. User opens Zaloga after swiping through 10+ items
2. Zaloga says: "I noticed you've been liking a lot of streetwear and neutral tones. Check these out:"
3. 4 curated product cards appear, matched to user's taste profile
4. User says "Show me something in olive green"
5. Zaloga vector-searches catalog for olive green items
6. Returns 3 new recommendations
```

### Flow C: User uploads a clothing photo

```
1. User taps 📷 button in chat input
2. Image picker opens (expo-image-picker)
3. User selects photo of a shirt from camera roll
4. Image uploads to S3 (presigned POST)
5. Image preview appears in chat
6. User types: "What pants go with this?"
7. Zaloga analyzes the image via GPT-4o vision + searches catalog
8. Returns matched items: "This linen shirt would pair well with..."
```

### Flow D: Guest user

```
1. Guest (no login) opens Zaloga
2. Guest has been swiping — Likes stored under guestId
3. Zaloga: "I see you're shopping as a guest. Want to create an account to save your style profile?"
4. Guest can still get recommendations based on their guestId likes
5. "Sign up" prompt appears as an option in the flow
```

---

## 5. DATA ARCHITECTURE

### 5.1 Chat Storage (MongoDB)

```js
// StylistConversation
{
  _id: ObjectId,
  user: ObjectId,           // optional — null for guests
  guestId: String,          // optional — null for authenticated
  messages: [
    {
      role: 'user' | 'assistant' | 'system',
      content: String,
      imageUrl: String,      // optional — S3 URL
      productIds: [ObjectId], // optional — products recommended
      createdAt: Date
    }
  ],
  messageCount: Number,     // counter for 16MB ceiling check
  createdAt: Date,
  updatedAt: Date
}

// Indexes:
// { user: 1, updatedAt: -1 }
// { guestId: 1, updatedAt: -1 }
// { createdAt: 1 } — TTL: 30 days
```

### 5.2 Product Embedding

```js
// Product (modified)
{
  // ... existing fields ...
  embedding: [Number],  // NEW: 1536-dim array from text-embedding-3-small
}

// Atlas Vector Search index:
// {
//   "fields": [{
//     "type": "vector",
//     "path": "embedding",
//     "numDimensions": 1536,
//     "similarity": "cosine"
//   }]
// }
```

### 5.3 Style Profile Shape

```js
{
  userId: ObjectId | guestId: String,
  preferences: {
    categories: ['Streetwear', 'Casual'],
    colors: ['Black', 'Olive'],
    brands: ['Nike', 'Carhartt']
  },
  likedProductSummary: {
    tags: ['cotton', 'oversized', 'minimal'] (weighted),
    categories: ['T-Shirts', 'Outerwear'] (weighted),
    brands: ['Nike'] (weighted),
    priceRange: { min: 20, max: 150, avg: 65 }
  },
  wishlistCount: 5,
  cartItems: 2,
  recentInteractions: [
    { action: 'like', productId: '...', tags: [...], at: timestamp },
    // ... last 20
  ]
}
```

---

## 6. COLOR PALETTE & STYLING (for Zaloga UI)

Following the existing app's design language:

| Element | Style |
|---------|-------|
| FAB background | `#1a1a1a` (black orb) |
| FAB icon | White sparkle/letter |
| Sheet background | `#ffffff` (white) |
| Sheet handle | `#e0e0e0` (gray bar) |
| AI message bg | `#f5f5f5` (light gray) |
| User message bg | `#1a1a1a` (black) |
| User message text | `#ffffff` (white) |
| AI text | `#1a1a1a` |
| Product card border | `#eaeaea` |
| Price text | `#1a1a1a` |
| Suggested chips | `#f0f0f0` bg, `#000` text |
| Font (headers) | Zaloga |
| Font (messages) | System (San Francisco / Roboto) |

---

## 7. IMPLEMENTATION ORDER

| Step | Component | Est. time |
|------|-----------|-----------|
| 1 | Backend models (StylistConversation + Product embedding) | 2h |
| 2 | Backend Vector Search setup + OpenAI integration | 3h |
| 3 | Backend style profile aggregation | 1.5h |
| 4 | Backend chat endpoint | 2h |
| 5 | Frontend FAB component | 1.5h |
| 6 | Frontend bottom sheet + chat UI | 3h |
| 7 | Image upload (backend relax + frontend picker) | 2h |
| 8 | Swipe data integration | 1h |
| 9 | Testing + edge cases | 3h |
| | **Total** | **~19h** (3 days) |

---

## 8. WHAT STAYS UNCHANGED ✅

- Home screen card deck (useSwipeAnimations.ts)
- Swipe gestures (right=like, left=dislike, up=detail)
- Header with heart + bell
- Filter row
- Tab bar layout
- All existing routes and models
- All vendor screens
- Authentication flow
- Product detail modal
- Search screen
- Wishlist, Cart, Profile screens
- Guest mode logic
- All website pages
