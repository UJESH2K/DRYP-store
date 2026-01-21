import {create} from 'zustand';

type ToastType = 'success' | 'error' | 'info';

interface ToastState {
  isVisible: boolean;
  message: string;
  type: ToastType;
  duration: number;
  showToast: (message: string, type?: ToastType, options?: { duration?: number }) => void;
  hideToast: () => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  isVisible: false,
  message: '',
  type: 'info',
  duration: 4000,
  showToast: (message, type = 'info', options = {}) => {
    const { duration = 4000 } = options;
    set({ isVisible: true, message, type, duration });
    
    setTimeout(() => {
      get().hideToast();
    }, duration);
  },
  hideToast: () => set({ isVisible: false, message: '', type: 'info' }),
}));
