/**
 * pushNotifications.js — server-side push notification helper.
 *
 *   sendPush(userIds, { title, body, data })
 *
 * Looks up the user's Expo push tokens and dispatches via the
 * Expo Push API. Failures are logged but never throw — the
 * calling route shouldn't crash because push delivery hiccuped.
 *
 * Expo's HTTP/2 endpoint:
 *   POST https://exp.host/--/api/v2/push/send
 *   body: { to: <token>, title, body, data, sound, badge }
 *
 * A single token is sent as one message. We deliberately do
 * NOT batch into a single /send with `to: [...]` because Expo
 * returns per-recipient status and we want to detect invalid
 * tokens so we can drop them on the user record.
 */
const User = require('../models/User');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function dispatchOne(token, message) {
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ to: token, ...message }),
    });
    const body = await res.json().catch(() => ({}));
    // Expo returns errors like:
    //   { data: [{ status: 'error', message: 'Invalid token', details: { error: 'DeviceNotRegistered' } }] }
    const ticket = body?.data?.[0];
    return ticket;
  } catch (e) {
    return { status: 'error', message: e?.message ?? 'fetch failed' };
  }
}

/**
 * Send a push notification to one or more users.
 *
 *   await sendPush(userIds, {
 *     title: 'Your order shipped',
 *     body:  'Order #1234 is on its way',
 *     data:  { url: '/orders/1234', orderId: '1234' },
 *     sound: 'default',
 *   });
 *
 * Invalid tokens are removed from the user record so we don't
 * keep retrying dead devices.
 */
async function sendPush(userIds, message) {
  if (!Array.isArray(userIds)) userIds = [userIds];
  if (!userIds.length) return { sent: 0 };
  const users = await User.find({ _id: { $in: userIds } }).select('pushTokens');
  const tokens = [];
  for (const u of users) {
    for (const t of u.pushTokens || []) {
      // Expo tokens are case-sensitive and start with "ExponentPushToken[…]"
      if (typeof t.token === 'string' && t.token.startsWith('ExponentPushToken')) {
        tokens.push({ userId: u._id, token: t.token });
      }
    }
  }
  if (!tokens.length) return { sent: 0 };

  let sent = 0;
  const deadTokens = [];

  // Expo recommends batching up to 100 per request to avoid
  // their per-request time limits. We use a simple sequential
  // dispatch (no parallelism) because the volume per request
  // is tiny.
  for (const batch of chunk(tokens, 100)) {
    for (const { userId, token } of batch) {
      const ticket = await dispatchOne(token, message);
      if (ticket?.status === 'ok') sent++;
      else if (ticket?.details?.error === 'DeviceNotRegistered' || ticket?.status === 'error') {
        deadTokens.push({ userId, token });
      }
    }
  }

  // Sweep dead tokens in a single bulk write.
  if (deadTokens.length) {
    try {
      for (const { userId, token } of deadTokens) {
        await User.updateOne(
          { _id: userId },
          { $pull: { pushTokens: { token } } },
        );
      }
    } catch (e) {
      console.warn('[push] failed to clean up dead tokens:', e?.message);
    }
  }

  return { sent, dead: deadTokens.length };
}

module.exports = { sendPush };