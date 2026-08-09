import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { type Item } from '../types';

// Styl Spec — Recommendation Engine
// - Weighted events with timestamp decay
// - User profile vectors (tags, categories, brands, colors, price tier)
// - Real-time re-ranking with exploration bucket (10–20%)

type EventType = 'view' | 'like' | 'cart' | 'purchase' | 'chat_interest'

const EVENT_WEIGHTS: Record<EventType, number> = {
  view: 1,
  like: 3,
  cart: 5,
  purchase: 10,
  chat_interest: 4,
}

const HALF_LIFE_MS = 1000 * 60 * 30 // 30 min half-life
const EXPLORATION_RATE = 0.15 // 15% exploration by default

function decayFactor(ts: number) {
  const age = Date.now() - ts
  return Math.pow(0.5, age / HALF_LIFE_MS)
}

// In-memory profile (persisted lightly)
let profile = {
  tag: {} as Record<string, number>,
  category: {} as Record<string, number>,
  brand: {} as Record<string, number>,
  color: {} as Record<string, number>,
  priceTier: { low: 0, mid: 0, high: 0 } as Record<Item['priceTier'], number>,
}

async function saveProfile() {
  try { await AsyncStorage.setItem('styl:profile', JSON.stringify(profile)) } catch {}
}
async function loadProfile() {
  try {
    const raw = await AsyncStorage.getItem('styl:profile')
    if (raw) profile = { ...profile, ...JSON.parse(raw) }
  } catch {}
}

// Public API — call at app start
export async function initRecommender() {
  await loadProfile()
  // Cold start: if profile is empty, seed initial vectors from User.preferences
  if (profileEmpty()) {
    seedProfileFromPreferences()
  }
}

function profileEmpty() {
  return (
    Object.keys(profile.tag).length === 0 &&
    Object.keys(profile.category).length === 0 &&
    Object.keys(profile.brand).length === 0 &&
    Object.keys(profile.color).length === 0 &&
    profile.priceTier.low === 0 &&
    profile.priceTier.mid === 0 &&
    profile.priceTier.high === 0
  )
}

// Seed profile from User.preferences (auth store) — lazy require to break circular deps
function seedProfileFromPreferences() {
  try {
    const { useAuthStore } = require('../state/auth') as typeof import('../state/auth')
    const prefs = useAuthStore.getState().user?.preferences
    if (!prefs) return
    const w = EVENT_WEIGHTS.like
    for (const c of prefs.categories || []) profile.category[c] = (profile.category[c] || 0) + w
    for (const b of prefs.brands || []) profile.brand[b] = (profile.brand[b] || 0) + w
    for (const col of prefs.colors || []) profile.color[col] = (profile.color[col] || 0) + w
    saveProfile()
  } catch {}
}

// Cold start + category filter + diverse seed ordering
function scoreItem(item: Item): number {
  let s = 0
  // tags
  for (const t of item.tags) s += profile.tag[t] || 0
  // category/brand/color
  s += (profile.category[item.category] || 0)
  s += (profile.brand[item.brand] || 0)
  // approximate color match by tags/colors lists
  for (const c of item.colors || []) s += (profile.color[c] || 0) * 0.5
  // price tier
  s += profile.priceTier[item.priceTier] || 0
  return s
}

// Exploration injection: keep top K, then inject 15% random from the tail
export function rankItems(candidates: Item[]): Item[] {
  const scored = candidates
    .map(i => ({ i, s: scoreItem(i) }))
    .sort((a, b) => b.s - a.s)

  const n = scored.length
  if (n <= 4) return scored.map(x => x.i)

  const exploreCount = Math.max(1, Math.floor(n * EXPLORATION_RATE))
  const headCount = Math.max(3, Math.floor(n * (1 - EXPLORATION_RATE)))

  const head = scored.slice(0, headCount).map(x => x.i)
  const tail = scored.slice(headCount).map(x => x.i)

  // pick unique randoms from tail
  const injected: Item[] = []
  const used = new Set<number>()
  for (let k = 0; k < exploreCount && tail.length > 0; k++) {
    let idx = Math.floor(Math.random() * tail.length)
    // ensure variety
    let spins = 0
    while (used.has(idx) && spins < 5) { idx = Math.floor(Math.random() * tail.length); spins++ }
    used.add(idx)
    injected.push(tail[idx])
  }
  // interleave injected items every few items
  const result: Item[] = []
  const interval = Math.max(2, Math.floor(head.length / Math.max(1, injected.length)))
  let j = 0
  for (let i = 0; i < head.length; i++) {
    result.push(head[i])
    if ((i + 1) % interval === 0 && j < injected.length) {
      result.push(injected[j++])
    }
  }
  // append remainder
  while (j < injected.length) result.push(injected[j++])
  return result
}

// Record an event and update profile with decay
export function recordEvent(type: EventType, item: Item) {
  const w = EVENT_WEIGHTS[type]
  const ts = Date.now()
  const f = decayFactor(ts)
  const sign = 1 // negative signal could be applied for dislikes separately

  // Update profile weights
  for (const t of item.tags) profile.tag[t] = (profile.tag[t] || 0) + sign * w * f
  profile.category[item.category] = (profile.category[item.category] || 0) + sign * w * f
  profile.brand[item.brand] = (profile.brand[item.brand] || 0) + sign * w * f
  for (const c of item.colors || []) profile.color[c] = (profile.color[c] || 0) + 0.5 * w * f
  profile.priceTier[item.priceTier] = (profile.priceTier[item.priceTier] || 0) + 0.75 * w * f

  // global light decay to keep fresh
  for (const key of Object.keys(profile.tag)) profile.tag[key] *= 0.995
  for (const key of Object.keys(profile.category)) profile.category[key] *= 0.995
  for (const key of Object.keys(profile.brand)) profile.brand[key] *= 0.995
  for (const key of Object.keys(profile.color)) profile.color[key] *= 0.995
  profile.priceTier.low *= 0.995; profile.priceTier.mid *= 0.995; profile.priceTier.high *= 0.995
  
  saveProfile()
}

// Backwards compatibility with existing code paths
export function updateModel(action: 'like' | 'dislike' | 'cart' | 'view' | 'chat_interest', item: Item) {
  if (action === 'dislike') {
    // Apply a negative signal for dislikes
    const ts = Date.now(); const f = decayFactor(ts)
    for (const t of item.tags) profile.tag[t] = (profile.tag[t] || 0) - 2 * f
    profile.category[item.category] = (profile.category[item.category] || 0) - 2 * f
    profile.brand[item.brand] = (profile.brand[item.brand] || 0) - 2 * f
    for (const c of item.colors || []) profile.color[c] = (profile.color[c] || 0) - 1 * f
    profile.priceTier[item.priceTier] = (profile.priceTier[item.priceTier] || 0) - 1.5 * f
    saveProfile()
    return profile
  }
  // map to recordEvent
  recordEvent(
    action === 'cart' ? 'cart'
    : action === 'view' ? 'view'
    : action === 'chat_interest' ? 'chat_interest'
    : 'like',
    item
  )
  return profile
}

// Utility to mark that an item was viewed
export function onItemViewed(item: Item) {
  recordEvent('view', item)
}

type Interaction = {
  itemId: string
  action: 'like' | 'dislike' | 'cart' | 'view' | 'chat_interest'
  at: number
  tags: string[]
  priceTier: Item['priceTier']
}

type InteractionState = {
  history: Interaction[]
  pushInteraction: (i: Interaction) => void
}

export const useInteractionStore = create<InteractionState>()(
  persist(
    (set) => ({
      history: [],
      pushInteraction: (i) => set((s) => ({ history: [i, ...s.history].slice(0, 500) })),
    }),
    {
      name: 'interactions-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

export function recordInteraction(action: 'like' | 'dislike' | 'cart' | 'view' | 'chat_interest', item: Item) {
  updateModel(action, item)
  useInteractionStore.getState().pushInteraction({
    itemId: item.id,
    action,
    at: Date.now(),
    tags: item.tags,
    priceTier: item.priceTier,
  })
}