import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Phase 1 — Discovery & Swipe.
 *
 * The interactions store is the on-device record of the user's
 * behaviour. The recommender reads it to rank the home feed.
 *
 * Action types:
 *  - view:    the user saw the card (used for impressions, the
 *             decay baseline in the recommender).
 *  - like:    swiped right / tapped the heart.
 *  - dislike: swiped left / tapped the X.
 *  - cart:    swiped up / tapped the cart button.
 *  - purchase: (recorded by the post-purchase flow).
 *
 * Persistence: AsyncStorage so the model survives a refresh.
 * Cap at 500 entries so we don't grow unbounded.
 */

const STORAGE_KEY = 'interactions_history_v1'
const MAX_HISTORY = 500

export type InteractionAction =
  | 'view'
  | 'like'
  | 'dislike'
  | 'cart'
  | 'purchase'

export type Interaction = {
  itemId: string
  action: InteractionAction
  at: number
  tags: string[]
  priceTier: 'low' | 'mid' | 'high'
  brand?: string
  category?: string
  color?: string
}

type InteractionState = {
  history: Interaction[]
  hydrated: boolean
  pushInteraction: (i: Interaction) => Promise<void>
  hydrate: () => Promise<void>
  clear: () => Promise<void>
}

export const useInteractionStore = create<InteractionState>((set, get) => ({
  history: [],
  hydrated: false,
  pushInteraction: async (i) => {
    const next = [i, ...get().history.filter((h) => !(h.itemId === i.itemId && h.action === i.action))].slice(0, MAX_HISTORY)
    set({ history: next })
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch (_) { /* non-fatal */ }
  },
  hydrate: async () => {
    if (get().hydrated) return
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY)
      if (raw) set({ history: JSON.parse(raw), hydrated: true })
      else set({ hydrated: true })
    } catch (_) { set({ hydrated: true }) }
  },
  clear: async () => {
    set({ history: [] })
    try { await AsyncStorage.removeItem(STORAGE_KEY) } catch (_) {}
  },
}))