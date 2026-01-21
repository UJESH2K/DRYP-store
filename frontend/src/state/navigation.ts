import { create } from 'zustand';

interface NavigationState {
  history: string[];
  push: (path: string) => void;
  goBack: () => string | null;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  history: [],
  push: (path) => {
    set(state => {
      const newHistory = [path, ...state.history.filter(p => p !== path)];
      return { history: newHistory.slice(0, 10) }; // Keep last 10 for back logic
    });
  },
  goBack: () => {
    const history = get().history;
    if (history.length > 1) {
      const newHistory = history.slice(1);
      set({ history: newHistory });
      return newHistory[0] || null;
    }
    return null; // No history to go back to
  },
}));
