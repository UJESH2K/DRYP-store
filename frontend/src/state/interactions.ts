import { create } from 'zustand'

type Interaction = {
  itemId: string
  action: 'like' | 'dislike' | 'cart'
  at: number
  tags: string[]
  priceTier: 'low' | 'mid' | 'high'
}

type InteractionState = {
  history: Interaction[]
  pushInteraction: (i: Interaction) => void
}

export const useInteractionStore = create<InteractionState>((set) => ({
  history: [],
  pushInteraction: (i) => set((s) => ({ history: [i, ...s.history].slice(0, 500) })),
}))