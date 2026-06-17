/**
 * haptics.ts — a tiny shim around expo-haptics (with a
 * Vibration fallback if it's not installed).
 *
 *   import { haptics } from '../lib/haptics';
 *   haptics.light();
 *
 * We use the lazy require pattern so the import never throws
 * if the native module is missing.
 */
import { Platform, Vibration } from 'react-native';

type Haptic = {
  light(): void;
  medium(): void;
  success(): void;
  error(): void;
};

let H: any = null;
try { H = require('expo-haptics'); } catch (_) {}

function hapticImpulse(style: any) {
  if (!H) return;
  if (typeof H.impactAsync === 'function') {
    try { H.impactAsync(style); return; } catch (_) {}
  }
  if (typeof H.selectionAsync === 'function') {
    try { H.selectionAsync(); return; } catch (_) {}
  }
}

function notificationImpulse(type: any) {
  if (!H) return;
  if (typeof H.notificationAsync === 'function') {
    try { H.notificationAsync(type); return; } catch (_) {}
  }
}

export const haptics: Haptic = {
  light() {
    if (H) hapticImpulse(H.ImpactFeedbackStyle?.Light ?? 'light');
    else if (Platform.OS === 'ios') Vibration.vibrate(8);
  },
  medium() {
    if (H) hapticImpulse(H.ImpactFeedbackStyle?.Medium ?? 'medium');
    else Vibration.vibrate(15);
  },
  success() {
    if (H) notificationImpulse(H.NotificationFeedbackType?.Success ?? 'success');
    else Vibration.vibrate([0, 30, 60, 30]);
  },
  error() {
    if (H) notificationImpulse(H.NotificationFeedbackType?.Error ?? 'error');
    else Vibration.vibrate([0, 60, 30, 60]);
  },
};