import {create} from 'zustand';

type ToastType = 'success' | 'error' | 'info';

interface ToastButton {
  text: string;
  onPress: () => void;
}

interface ToastState {
  isVisible: boolean;
  message: string;
  type: ToastType;
  duration: number;
  button: ToastButton | null;
  showToast: (message: string, type?: ToastType, options?: { duration?: number; button?: ToastButton }) => void;
  hideToast: () => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  isVisible: false,
  message: '',
  type: 'info',
  duration: 4000,
  button: null,
  showToast: (message, type = 'info', options = {}) => {
    const { duration = 4000, button = null } = options;
    set({ isVisible: true, message, type, duration, button });

    setTimeout(() => {
      get().hideToast();
    }, duration);
  },
  hideToast: () => set({ isVisible: false, message: '', type: 'info', button: null }),
}));
