---
slug: zaloga-ai-stylist
status: awaiting-approval
intent: unclear
pending-action: write .omo/plans/zaloga-ai-stylist.md
approach: "Fashion AI stylist feature (Zaloga) integrated into the existing DRYP-store Expo mobile app with minimal bottom-bar disruption, using a floating chat head + bottom sheet pattern. Architecture: S3 for image storage, MongoDB (embedded messages + vector search) for chat history + product embeddings, OpenAI API for LLM recommendations via RAG over the product catalog."
---

# Draft: zaloga-ai-stylist

## Components (topology ledger)
| id | outcome | status |
|----|---------|--------|
| Backend AI Stylist Routes | New Express routes: POST /api/stylist/chat, POST /api/stylist/upload, GET /api/stylist/history | active |
| Chat Message Model | Mongoose schema for conversations + messages | active |
| User Style Profile Model | Aggregates likes/wishlist/cart/preferences into a stylist-readable profile | active |
| Image Upload Route for Users | Extend existing S3 presigned upload to non-vendors (or new endpoint) | active |
| LLM Integration (OpenAI) | Fashion recommendation via RAG over product catalog | active |
| Product Vector Search | MongoDB Atlas Vector Search index on product embeddings | active |
| Zaloga FAB Component | Floating action button over tab bar, animated | active |
| Zaloga Bottom Sheet | @gorhom/bottom-sheet chat panel with slide-up animation | active |
| Chat UI Components | Message bubbles, image attachment, product cards in chat | active |
| Style Preference Sync | Connect swipe data (likes/dislikes) to stylist context | active |
| Backend Agenda Job for Image Analysis | Background processing of uploaded clothing images | deferred |

## Open assumptions (announced defaults)
| assumption | adopted default | rationale | reversible? |
|-----------|----------------|-----------|-------------|
| Chat storage DB | MongoDB embedded messages in conversation doc (not separate collection, not PostgreSQL/Redis) | Already using MongoDB; keeps ops simple; document limit of 16MB allows ~5000 messages per conversation before needing reference pattern | Yes — can migrate to separate collection or Stream Chat later |
| Image storage | AWS S3 (existing infrastructure) | Backend already has S3 presigned upload; extend user access | Yes — can add CloudFront CDN layer |
| Vector search | MongoDB Atlas Vector Search | No new infra; product embeddings stored alongside product docs; free tier supports up to 100K vectors | Yes — can migrate to Pinecone/Weaviate |
| LLM provider | OpenAI GPT-4o-mini (cost-optimized) | Best quality/cost ratio for fashion recs; supports image understanding | Yes — swap to Claude/Gemini |
| Chat UI pattern | FAB (floating action button) + bottom sheet | Doesn't disrupt existing 5-tab bar; non-modal; dismissible; follows Instagram/Threads pattern | Yes — can promote to full tab |
| Context window | Last 20 messages + style profile summary | 4K tokens adequate for fashion advice; reduces cost vs full history | Yes — adjustable per plan tier |
| Image upload for users | Reuse existing `/api/upload/presign` but relax vendor-only check | Existing S3 infra already works; just needs auth guard changed | Yes — can create separate endpoint |

## Findings (cited - path:lines)
1. **No AI/chat/LLM exists in the backend** - `backend/` routes, models, utils contain zero AI code (Grok session: backend-investigation)
2. **Bottom tab bar is full (5 tabs)** - `frontend/app/(tabs)/_layout.tsx:53-92` shows Home, Search, Wishlist, Cart, Profile
3. **Swipe behavior**: right=like (POST /api/likes/:id), left=dislike (DELETE /api/likes/:id), up=detail modal (Grok session: swipe-data-flows)
4. **No "dislike" stored on backend** - swipe dislike only removes Like doc; no Dislike model exists
5. **Existing user preferences**: categories, colors, brands (User model `/backend/src/models/User.js:54-59`)
6. **Existing on-device recommender**: `frontend/src/lib/recommender.ts` - client-only, not used by backend
7. **S3 upload exists for vendors only**: `backend/src/routes/upload.js:91-147` - protect middleware + role check
8. **Product search is basic regex**: `backend/src/routes/products.js:29` - no $text index, no vector search
9. **Product model has rich metadata**: tags, brand, category, basePrice, variants with Color/Size options
10. **Zaloga font already loaded**: used across the app for headings and UI text
11. **Animated bottom sheet pattern exists**: ProductDetailModal uses Animated.View with translateY (95% height)
12. **Header pattern**: "DRYP" title (Zaloga 28px) + icon row (heart, bell)

## Decisions (with rationale)
1. **FAB + Bottom Sheet over new tab**: The bottom bar is at capacity (5 tabs). Adding a 6th would require redesigning the tab bar or replacing one. A FAB (floating action button) with the Zaloga logo overlaid on the tab bar, opening a draggable bottom sheet (like Instagram DMs), is the least disruptive approach. The FAB sits above the tab bar center, pulsating subtly to indicate availability.

2. **MongoDB embedded conversation docs for chat history**: Each conversation is a Mongo doc with an array of messages (sub-documents). This avoids JOINs, supports TTL indexing for auto-expiry, and keeps related data together. When conversations exceed 5000 messages, archive to a separate messages collection.

3. **S3 for user-uploaded images** (same bucket, different prefix): Reuse the existing S3 presigned upload infrastructure. Relax the vendor-only guard to include authenticated users. Images stored under `uploads/stylist/{userId}/{timestamp}-{hash}.{ext}`.

4. **MongoDB Atlas Vector Search over Pinecone**: Zero new infrastructure. Product embeddings stored in a new `embedding` field on the Product model. Atlas Vector Search index on `embedding` field. For a catalog of ~10K products, this is free-tier compatible. Pinecone becomes relevant at 100K+ products.

5. **OpenAI GPT-4o-mini for LLM**: Cost-effective ($0.15/1M input tokens), supports image inputs (for clothing photo analysis), fast. The system prompt includes the user's style profile (likes, dislikes, preferences, cart, purchase history) and the product catalog context from vector search results.

6. **No backend storage for dislikes initially**: The existing pattern (DELETE like = dislike signal) is sufficient for the stylist's context. Can add a Dislike model if precision on negative signals becomes necessary.

7. **Image analysis deferred to background Agenda job**: User uploads a clothing photo -> S3 -> Agenda job queues -> analyzes with GPT-4o vision -> extracts style attributes (colors, patterns, categories) -> stores as a "style reference" doc.

## Scope IN
- Zaloga FAB component with pulse animation
- Bottom sheet chat UI with message bubbles, product cards, image attachment
- Backend chat endpoint with RAG over product catalog
- OpenAI GPT-4o-mini integration for fashion recommendations
- Product embedding + MongoDB Atlas Vector Search
- User style profile aggregation (likes + preferences + cart + wishlist)
- User-facing image upload (relaxed S3 presigned endpoint)
- Chat history storage and retrieval
- Context window management (last 20 messages + profile summary)
- Swipe data integration into stylist context
- UI mockup in MD

## Scope OUT (Must NOT have)
- Do NOT remove or replace any existing tab
- Do NOT store images in MongoDB (GridFS) — S3 only
- Do NOT build a real-time/WebSocket chat — request-response is sufficient
- Do NOT add a dedicated "AI" tab to the bottom bar
- Do NOT implement voice chat
- Do NOT build a standalone AI model — use existing LLM APIs
- Do NOT modify the existing swipe logic for likes/dislikes/cart
- Do NOT require user login to use the stylist (guest mode supported)
- Do NOT add real-time presence/typing indicators

## Open questions
(none — all addressed by research defaults above)

## Approval gate
status: awaiting-approval
draft-complete: true
plans-written:
  - .omo/plans/zaloga-ai-stylist.md (work plan with 11 todos)
  - .omo/plans/zaloga-ui-mockup.md (complete UI wireframe)
<!-- When the user approves, run: $start-work to execute the plan -->
