# zaloga-ai-stylist - Work Plan

## TL;DR (For humans)

**What you'll get:** A gentle AI fashion stylist named Zaloga that lives as a floating orb above your bottom navigation — tap it, a chat panel slides up. Tell it what you're looking for ("date night outfit", "something with this shirt"), upload a photo, or let it learn from your swipes. It uses your existing Likes, Wishlist, Cart, and style preferences to recommend real products from your catalog.

**Why this approach:** Your bottom bar already has 5 tabs — adding a 6th would make it cramped. The floating orb + slide-up panel keeps the existing UI untouched while giving Zaloga a persistent, non-intrusive home. The AI runs on GPT-4o-mini (the smart-cheap model) with your product catalog as its knowledge base, so recommendations are always from your actual inventory.

**What it will NOT do:** Replace any existing feature. Require login (guests get a stylist too). Store pictures inside your database (they go to S3). Use real-time chat or voice. Add a new bottom tab.

**Effort:** Large — ~2-3 weeks for a full implementation with testing
**Risk:** Medium — new AI dependency (OpenAI API costs, latency) and MongoDB Atlas Vector Search config

**Decisions I made for you:**
1. Floating orb + bottom sheet instead of a new tab (keeps UI clean)
2. MongoDB embeddings instead of Pinecone (no new infra, free tier works)
3. S3 for images (already set up, just need to open it to users)
4. GPT-4o-mini (best quality/cost for fashion)
5. Chat stored in MongoDB conversation docs (simple, no new DB)
6. Last 20 messages + style profile as LLM context (4K tokens, cost-effective)

Your next move: **Approve this plan** and say "start work" — or tell me what to adjust.

---

> TL;DR (machine): Large effort, medium risk (AI dependency). Deliverables: FAB component + bottom sheet chat UI on mobile, RAG-based AI stylist backend (OpenAI + MongoDB Atlas Vector Search), S3-based image upload for users, swipe-data integration, chat history storage.

## Scope
### Must have
- Zaloga FAB (floating action button) rendered above the tab bar on the Home screen
- Bottom sheet chat panel (slide-up, dismissible, draggable) — @gorhom/bottom-sheet
- Chat message UI: user messages, AI responses with embedded product recommendations
- Image attachment in chat: camera roll picker -> S3 upload -> displayed in chat
- Backend `POST /api/stylist/chat` endpoint — accepts text + optional imageUrl, returns AI recommendation
- OpenAI GPT-4o-mini integration with system prompt containing user style profile
- MongoDB Atlas Vector Search index on Product.embedding field
- Product embedding generation (background job or on-save hook)
- RAG pipeline: embed user query -> vector search top-10 products -> inject into LLM context
- User style profile: aggregate Liked products + Wishlist + Cart + User.preferences -> stylist context
- Guest mode: guest users get stylist based on their guestId's likes/preferences
- Chat history: store conversations in MongoDB, retrieve last N messages
- Context window management: include only last 20 messages + style profile summary (4K token target)

### Must NOT have (guardrails, anti-slop, scope boundaries)
- Do NOT remove or replace any existing tab in `(tabs)/_layout.tsx`
- Do NOT store images in MongoDB (GridFS) — S3 only
- Do NOT build real-time/WebSocket chat — request-response is fine
- Do NOT add a dedicated "AI" tab to the bottom bar
- Do NOT implement voice chat or audio
- Do NOT build/train a custom ML model — use existing LLM APIs
- Do NOT modify existing swipe logic (useSwipeAnimations.ts untouched)
- Do NOT require authentication for stylist (guest mode required)
- Do NOT add push notifications for stylist responses
- Do NOT create a separate admin panel for stylist

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after + manual QA via the app
- Evidence: .omo/evidence/task-<N>-zaloga-ai-stylist.<ext>

## Execution strategy
### Parallel execution waves
- **Wave 1** (backend core): Todo 1-3 — Models + Vector Search + OpenAI integration
- **Wave 2** (UI core): Todo 4-6 — FAB + Bottom Sheet + Chat components
- **Wave 3** (integration): Todo 7-9 — Upload + Style Profile + Swipe Data
- **Wave 4** (backfill & QA): Todo 10-11 — Chat history + Final integration testing

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1. MongoDB Chat & Stylist Models | — | 3, 8, 9 | 2 |
| 2. MongoDB Atlas Vector Search Setup | — | 3 | 1 |
| 3. OpenAI LLM + RAG Pipeline | 1, 2 | 7, 8 | — |
| 4. Zaloga FAB Component | — | 5 | 1, 2, 3 |
| 5. Bottom Sheet Chat UI | 4 | 6 | — |
| 6. Chat Message + Product Card Components | 5 | 7 | — |
| 7. User Image Upload (S3 + chat) | 3, 6 | 9 | 8 |
| 8. Style Profile Aggregation | 1 | 9 | 7 |
| 9. Chat History + Context Window | 7, 8 | 10 | — |
| 10. Swipe Data Integration | 8 | — | 9 |
| 11. Final Verification + QA | 10 | — | — |

## Todos

- [x] 1. **Backend: Create ChatMessage + StylistConversation models**
  What to do / Must NOT do: Create two Mongoose models under `backend/src/models/`. StylistConversation stores the conversation doc with embedded messages. Must support both authenticated users (user ObjectId) and guests (guestId string). Must NOT exceed 16MB per document — add a message count check. Must include timestamps.
  Parallelization: Wave 1 | Blocked by: — | Blocks: 3, 8
  References: `backend/src/models/Like.js` (existing pattern for user+guestId), `backend/src/models/Product.js`
  Acceptance criteria: `node -e "require('./src/models/StylistConversation'); console.log('models load OK')"` from backend dir
  QA scenarios: happy — create conversation with 3 messages, verify embedded array; failure — attempt >5000 messages, verify rejection
  Commit: Y | feat(backend): add StylistConversation and ChatMessage models

- [x] 2. **Backend: MongoDB Atlas Vector Search index + product embedding job**
  What to do / Must NOT do: Add `embedding` field (array of 1536 floats) to Product model. Create a migration script to generate embeddings for existing products using OpenAI text-embedding-3-small. Create a `POST /api/stylist/embed` endpoint or Agenda job to embed new products on save. Create Atlas Vector Search index on the `embedding` field. Must NOT break existing product queries.
  Parallelization: Wave 1 | Blocked by: — | Blocks: 3
  References: `backend/src/models/Product.js` (add embedding field), MongoDB Atlas Vector Search docs
  Acceptance criteria: `GET /api/products` still returns products; embedding field present on products after migration
  QA scenarios: happy — embed 5 products, verify vector search returns similar products; failure — no OpenAI key, graceful fallback without crash
  Commit: Y | feat(backend): add product embeddings and Atlas Vector Search

- [x] 3. **Backend: OpenAI integration + RAG chat endpoint**
  What to do / Must NOT do: Create `backend/src/services/stylist.js` — integrates OpenAI GPT-4o-mini. Implement RAG pipeline: embed user query -> vector search top 10 products -> build prompt with product context -> call OpenAI -> return structured recommendation. Create `POST /api/stylist/chat` endpoint that accepts `{ message: string, conversationId?: string, imageUrl?: string }` and returns `{ reply: string, productIds: string[], conversationId: string }`. Must NOT leak API keys. Must handle OpenAI rate limits and timeouts gracefully.
  Parallelization: Wave 1 | Blocked by: 1, 2 | Blocks: 7, 8
  References: OpenAI API docs, `backend/src/routes/upload.js` for route pattern, `backend/server.js` for route mounting
  Acceptance criteria: `curl -X POST http://localhost:5000/api/stylist/chat -H 'Content-Type: application/json' -d '{"message":"what should I wear for a summer date?"}'` returns structured reply with product recommendations
  QA scenarios: happy — valid request returns recommendations with product IDs; failure — empty message returns 400; failure — OpenAI timeout returns 503 with friendly message
  Commit: Y | feat(backend): implement AI stylist chat with RAG over product catalog

- [x] 4. **Frontend: Zaloga Floating Action Button (FAB)**
  What to do / Must NOT do: Create `frontend/src/components/stylist/ZalogaFAB.tsx` — a floating orb/button positioned above the center of the tab bar on Home screen. Must use `position: absolute`, `bottom: 70` (above tab bar). Must have a subtle pulse animation (react-native-reanimated). Icon: a sparkle or "Z" logo in Zaloga font. Must NOT interfere with existing tab bar touch targets. Must NOT appear on vendor tabs. Dispatch: tapping the FAB opens the Zaloga bottom sheet.
  Parallelization: Wave 2 | Blocked by: — | Blocks: 5
  References: `frontend/app/(tabs)/_layout.tsx:39-51` (tab bar position), `frontend/app/(tabs)/home.tsx` (renders FAB here), `frontend/src/constants/dimensions.ts`
  Acceptance criteria: FAB visible on home screen above tab bar; tapping it logs "open zaloga" (before bottom sheet is built); pulse animation plays at 2fps
  QA scenarios: happy — FAB renders, animates, and is tappable; failure — on vendor tab screens, FAB is not rendered
  Commit: Y | feat(frontend): add Zaloga FAB component with pulse animation

- [x] 5. **Frontend: Zaloga Bottom Sheet Chat Panel**
  What to do / Must NOT do: Create `frontend/src/components/stylist/ZalogaSheet.tsx` using @gorhom/bottom-sheet. Must slide up from bottom (snap points: ['90%', '50%']). Must have a handle bar at top, close button, and safe area insets. Must render chat messages inside a FlashList. Must NOT block the tab bar when dismissed. Must NOT use modals.
  Parallelization: Wave 2 | Blocked by: 4 | Blocks: 6
  References: `frontend/src/components/ProductDetailModal.tsx` (existing bottom panel pattern), @gorhom/bottom-sheet docs
  Acceptance criteria: tapping Zaloga FAB opens the sheet; dragging down dismisses it; sheet doesn't cover status bar
  QA scenarios: happy — open, type a message, close; failure — sheet content scrolls behind the handle
  Commit: Y | feat(frontend): add Zaloga bottom sheet chat panel

- [x] 6. **Frontend: Chat Message + Product Recommendation Card Components**
  What to do / Must NOT do: Create `frontend/src/components/stylist/ChatBubble.tsx` (user message, AI message variants), `frontend/src/components/stylist/ProductCard.tsx` (mini product card for recommendations — image, name, price, brand). Create `frontend/src/components/stylist/ChatInput.tsx` (text input + camera/image attachment button + send button). Must support markdown rendering in AI messages (simple bold/italic/links). Must NOT render full ProductDetailModal — tapping a product card navigates to product detail screen.
  Parallelization: Wave 2 | Blocked by: 5 | Blocks: 7
  References: `frontend/src/components/home/Card.tsx` (product card pattern), `frontend/src/components/ProductDetailModal.tsx` (tapping navigates to `/product/[id]`)
  Acceptance criteria: message bubbles render with correct alignment; product cards show image, name, price; tapping product card navigates to product detail
  QA scenarios: happy — send message, see AI reply with product cards; failure — empty message shows validation
  Commit: Y | feat(frontend): add chat bubble and product recommendation card components

- [x] 7. **Frontend + Backend: User-facing image upload for stylist**
  What to do / Must NOT do: Extend `POST /api/upload/presign` to allow authenticated users (not just vendors) to upload images for the stylist. Or create a new `POST /api/stylist/upload` endpoint. Images stored under `uploads/stylist/{userId}/` prefix. Frontend: add image picker (expo-image-picker) to ChatInput, upload via presigned POST, display attached image in chat bubble. Must NOT allow uploading non-image files. Must NOT exceed 10MB.
  Parallelization: Wave 3 | Blocked by: 3, 6 | Blocks: 9
  References: `backend/src/routes/upload.js:88-147` (existing S3 presigned upload), `frontend/src/components/stylist/ChatInput.tsx`
  Acceptance criteria: user can pick image from camera roll, it uploads to S3, image appears in chat bubble before sending message
  QA scenarios: happy — pick image, upload, see it in chat; failure — upload >10MB shows error; failure — pick non-image shows error
  Commit: Y | feat(backend+frontend): add user image upload for stylist chat

- [x] 8. **Backend: User style profile aggregation service**
  What to do / Must NOT do: Create `backend/src/services/styleProfile.js` — fetches and aggregates: User.preferences (categories, colors, brands), Liked products (tags, categories, brands), Wishlist items, Cart items, Order history. Produces a structured style profile object. Must support guest users (likes only, no preferences/orders). Must cache per-user profile for 5 minutes. This profile is injected into the AI stylist system prompt.
  Parallelization: Wave 3 | Blocked by: 1 | Blocks: 9
  References: `backend/src/models/Like.js`, `backend/src/models/WishlistItem.js`, `backend/src/models/Cart.js`, `backend/src/models/User.js`, `backend/src/models/Order.js`
  Acceptance criteria: `node -e "require('./src/services/styleProfile').getProfile('test-user-id').then(console.log)"` returns structured profile with preferences, likes summary, wishlist count
  QA scenarios: happy — authenticated user has complete profile; happy — guest user has minimal profile (likes only); failure — user with no interactions returns empty profile (no crash)
  Commit: Y | feat(backend): add style profile aggregation service

- [x] 9. **Backend: Chat history storage + context window management**
  What to do / Must NOT do: Implement chat conversation CRUD in the stylist service. On each chat request: load conversation by ID (or create new), append user message, build context (last 20 messages + style profile + top 10 vector results), call OpenAI, append AI response, save conversation. Implement TTL index on conversations older than 30 days. Must NOT load the entire message history — only the context window. Must NOT include system messages in the response to the client.
  Parallelization: Wave 3 | Blocked by: 7, 8 | Blocks: 10
  References: StylistConversation model from todo 1, `backend/src/services/stylist.js` from todo 3
  Acceptance criteria: after 3 chat exchanges, GET /api/stylist/history returns all conversations with messages; conversation older than 30 days is auto-deleted
  QA scenarios: happy — send 25 messages, verify only last 20 are in context window; failure — conversation ID not found returns 404 with create-new prompt
  Commit: Y | feat(backend): implement chat history with context window management

- [x] 10. **Frontend: Swipe data integration into stylist context**
  What to do / Must NOT do: Connect the existing swipe gesture signals (right=like, left=dislike, up=detail) to the stylist's context. When the user opens Zaloga, include recent swipe history (last 50 interactions from `useInteractionStore`) in the initial context. Show a "Based on your recent likes..." suggestion in the chat. Must NOT modify `useSwipeAnimations.ts`. Must NOT slow down swipe performance.
  Parallelization: Wave 4 | Blocked by: 8 | Blocks: —
  References: `frontend/src/hooks/useSwipeAnimations.ts` (read-only — don't modify), `frontend/src/state/interactions.ts` (interactions store with history)
  Acceptance criteria: after swiping right on 3 streetwear items, opening Zaloga shows "I noticed you like streetwear! Try pairing these items..."
  QA scenarios: happy — 10 swipes, then open chat, AI references liked items; failure — no interactions, AI asks what user is looking for
  Commit: Y | feat(frontend): integrate swipe interaction data into Zaloga stylist context

- [~] 11. **Final Verification + QA**
  What to do / Must NOT do: Run the full verification wave. Test every endpoint. Verify FAB renders correctly across iPhone SE, iPhone 14/15, Android Pixel/ Samsung. Test with real OpenAI API key (or mock). Test with Atlas Vector Search enabled. Verify guest mode flow. Verify all edge cases: empty catalog, no OpenAI key configured, network timeout, very long messages, special characters in chat.
  Parallelization: Wave 4 | Blocked by: 10 | Blocks: —
  References: All todo implementations
  Acceptance criteria: All QA scenarios across all todos pass. The stylist can answer a fashion question with real product recommendations end-to-end.
  QA scenarios: See each todo above.
  Commit: Y | test: final verification and QA for Zaloga AI stylist

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE.
- [x] F1. Plan compliance audit — verify all Must Have items implemented, all Must NOT Have items absent
- [x] F2. Code quality review — check for ponytail violations, over-engineering, dead code, missing error handling
- [~] F3. Real manual QA — open the app on device, swipe some items, open Zaloga, send a message, verify product recommendations appear
- [x] F4. Scope fidelity — confirm no existing tab was modified, no tab was added, guest mode works

## Commit strategy
- Each todo = one atomic commit with conventional commit format
- Branch: `feat/zaloga-ai-stylist` (one branch, sequential commits)
- No force pushes, no squash merges

## Success criteria
1. User can tap the Zaloga FAB and open a chat panel from any main tab
2. AI stylist responds with real product recommendations from the catalog
3. User can upload a clothing photo and get recommendations based on it
4. Stylist references user's liked items and preferences in its recommendations
5. Guest users can use the stylist (based on guestId likes)
6. Chat history persists across app restarts
7. Bottom tab bar is unchanged — no 6th tab added
8. Existing swipe logic is unmodified
