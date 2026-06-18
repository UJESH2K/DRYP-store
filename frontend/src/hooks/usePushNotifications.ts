/**
 * usePushNotifications — registers for Expo push tokens and
 * posts them to the backend.
 *
 *   const { token, status } = usePushNotifications();
 *
 * - On Android we use the FCM Expo push channel.
 * - On iOS we use APNs.
 * - On web / unsupported platforms the hook returns
 *   `{ status: 'unsupported' }` and never throws.
 *
 * The token is re-registered whenever the user changes (login
 * / logout / switch account).
 *
 * This hook depends on `expo-notifications` and `expo-device`.
 * Both are optional at install time — we wrap the imports in
 * try/catch so a missing native module doesn't crash the app.
 */
import { useEffect, useState, useRef } from 'react';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

type Status = 'pending' | 'granted' | 'denied' | 'unsupported' | 'error';

let Notifications: any = null;
let Device: any = null;
try { Notifications = require('expo-notifications'); } catch (_) {}
try { Device = require('expo-device'); } catch (_) {}

// Configure how notifications appear when the app is foregrounded.
// Set once at module load — Expo Notifications reads this on each
// notification arrival.
if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export function usePushNotifications(userId?: string | null) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('pending');
  const [error, setError] = useState<string | null>(null);
  // Use a ref so the listener's cleanup uses the latest userId.
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  useEffect(() => {
    if (!Notifications || !Device) {
      setStatus('unsupported');
      return;
    }
    if (!Device.isDevice) {
      // Push tokens are not available in the simulator/emulator.
      setStatus('unsupported');
      return;
    }

    let cancelled = false;
    let notificationSub: { remove: () => void } | null = null;
    let responseSub: { remove: () => void } | null = null;

    (async () => {
      try {
        // Permission
        const { status: existing } = await Notifications.getPermissionsAsync();
        let final = existing;
        if (existing !== 'granted') {
          const { status: requested } = await Notifications.requestPermissionsAsync();
          final = requested;
        }
        if (cancelled) return;
        if (final !== 'granted') {
          setStatus('denied');
          return;
        }
        setStatus('granted');

        // Android requires a notification channel to be set up
        // before the app can show notifications. Channel id
        // 'default' is the one Expo's docs use.
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance?.MAX ?? 5,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
          });
        }

        // Project id is read from app.json's `extra.eas.projectId`.
        // In Expo Go this is null and the call will fail — we
        // swallow that case because Expo Go users can't receive
        // push notifications anyway.
        const projectId = (Constants?.expoConfig as any)?.extra?.eas?.projectId
          ?? (Constants?.easConfig as any)?.projectId;
        const tokenResp = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        if (cancelled) return;
        setExpoPushToken(tokenResp.data);

        // Foreground notifications: surface as toasts / store updates.
        notificationSub = Notifications.addNotificationReceivedListener(
          (notif: any) => {
            // The mobile app's notification list reads from the
            // backend; this listener is intentionally a no-op so
            // we don't double-write the same notification.
            console.log('[push] received (foreground):', notif?.request?.content?.title);
          },
        );
        // Tap: deep link into the relevant screen.
        responseSub = Notifications.addNotificationResponseReceivedListener(
          (resp: any) => {
            const data = resp?.notification?.request?.content?.data;
            if (data?.url) {
              try {
                const Linking = require('expo-linking');
                Linking.openURL(data.url);
              } catch (_) {}
            }
          },
        );
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? 'unknown');
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      notificationSub?.remove?.();
      responseSub?.remove?.();
    };
  }, []);

  // Whenever the token or the userId changes, push the (token, user)
  // pair to the backend so we can target them later.
  useEffect(() => {
    if (!expoPushToken || !userId) return;
    (async () => {
      try {
        const { apiCall } = require('../lib/api');
        await apiCall('/api/users/push-token', {
          method: 'POST',
          body: JSON.stringify({
            token: expoPushToken,
            platform: Platform.OS,
            appVersion: (Constants?.expoConfig as any)?.version ?? null,
          }),
        });
      } catch (e) {
        console.warn('[push] failed to register token:', e);
      }
    })();
  }, [expoPushToken, userId]);

  return { token: expoPushToken, status, error };
}