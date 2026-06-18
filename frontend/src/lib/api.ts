import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../state/auth';

// EXPO_PUBLIC_API_BASE_URL is inlined at bundle time. In production builds
// it must be set — fall back to a clear sentinel so misconfigured builds
// fail loudly in the first network call instead of silently hitting a
// developer's LAN IP (port 8080 to match the deployed backend).
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || '';

// Debug logging is gated behind __DEV__ so request/response bodies (which may
// contain credentials) never reach device logs in production builds.
const debugLog = (...args: unknown[]) => {
  if (__DEV__) console.log(...args);
};
const debugWarn = (...args: unknown[]) => {
  if (__DEV__) console.warn(...args);
};
const debugError = (...args: unknown[]) => {
  if (__DEV__) console.error(...args);
};

// Log the API URL being used for debugging (in dev only)
debugLog('🌐 API Base URL:', API_BASE_URL);

// Simple fetch wrapper with error handling and auth token injection
export async function apiCall(endpoint: string, options: RequestInit = {}) {
  // Fail fast if the API URL is not configured. Without this, every
  // request silently hits a non-existent host in production builds
  // where EXPO_PUBLIC_API_BASE_URL was never set.
  if (!API_BASE_URL) {
    return {
      message:
        'API not configured. Set EXPO_PUBLIC_API_BASE_URL in frontend/.env before building.',
    };
  }
  try {
    const fullUrl = `${API_BASE_URL}${endpoint}`;
    debugLog(`🚀 FRONTEND API CALL: ${options.method || 'GET'} ${fullUrl}`);

    const { token, isGuest, guestId } = useAuthStore.getState();
    debugLog(`🔑 Auth Token:`, token ? 'Present' : 'Missing');

    const headers = { ...options.headers };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (isGuest && guestId) {
      headers['x-guest-id'] = guestId;
    }

    let body = options.body;

    // Don't set Content-Type for FormData, and don't stringify the body
    if (!(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      if (body) {
        debugLog(`📤 Sending data:`, body);
      }
    }

    const response = await fetch(fullUrl, {
      ...options,
      body,
      headers,
    });

    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.indexOf('application/json') !== -1) {
      data = await response.json();
    } else {
      const textData = await response.text();
      // For non-JSON, we can't assume a { message: ... } structure
      // If the request was not ok, we create an error structure
      if (!response.ok) {
          debugWarn(`❌ API call failed with non-JSON response: ${endpoint}`, response.status, textData);
          return { message: textData || 'An unknown error occurred on the server.' };
      }
      // If the request was ok but not JSON, we return it as content
      data = { content: textData };
    }

    if (!response.ok) {
      debugWarn(`❌ API call failed: ${endpoint}`, response.status, data);
      // On 401, the session is dead — wipe the auth state and
      // bounce the user back to the login screen so they don't
      // sit on a screen that endlessly retries. We use a lazy
      // require to avoid a circular import with the auth store.
      if (response.status === 401) {
        try {
          const auth = useAuthStore.getState();
          if (auth.token && !auth.isGuest) {
            auth.logout?.();
            const { router } = require('expo-router');
            router.replace('/login');
          }
        } catch (_) {
          // ignore: this is best-effort
        }
      }
      return data; // Return error data from server
    }

    debugLog(`✅ API success: ${endpoint}`, data);
    return data;
  } catch (error) {
    debugError(`❌ API error: ${endpoint}`, error);
    debugError(`❌ Full URL was: ${API_BASE_URL}${endpoint}`);
    return { message: error.message || 'An unexpected error occurred.' };
  }
}

// Send user interaction to backend (like, dislike, cart)
export async function sendInteraction(action: 'like' | 'dislike', itemId: string) {
  const payload: { [key: string]: any } = {
    productId: itemId,
  };
  
  const { isGuest, guestId } = useAuthStore.getState();
  if (isGuest && guestId) {
    payload.guestId = guestId;
  }

  if (action === 'like') {
    return apiCall(`/api/likes/${itemId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  if (action === 'dislike') {
    return apiCall(`/api/likes/${itemId}`, {
      method: 'DELETE',
      body: JSON.stringify(payload),
    });
  }
}

// Fetch products from backend (optional - can be used to replace static data later)
export async function fetchProducts() {
  return apiCall('/api/products');
}

// Health check
export async function checkBackendHealth() {
  return apiCall('/health');
}

// -----------------------------------------------------------------------------
// Password reset
//
// Backend exposes:
//   POST /api/auth/forgot-password   { email }                 -> 200 always
//   PUT  /api/auth/reset-password/:token { password }          -> 200 / 4xx
//
// The mobile flow: user taps "Forgot password" on /login → enters email →
// backend emails them a link with a token. The email link goes to the
// website by default; the "Open in DRYP App" link opens
// `dryp://reset-password/<token>` which Linking intercepts and routes
// into `app/reset-password/[token].tsx`. That screen calls
// `resetPassword` below.
// -----------------------------------------------------------------------------

export async function forgotPassword(email: string) {
  return apiCall('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, password: string) {
  return apiCall(`/api/auth/reset-password/${encodeURIComponent(token)}`, {
    method: 'PUT',
    body: JSON.stringify({ password }),
  });
}
