import { API_BASE_URL, apiCall } from './api';
import { useAuthStore } from '../state/auth';

const AI_ENDPOINT = process.env.EXPO_PUBLIC_AI_STYLIST_ENDPOINT || '/api/ai/zaloga';

export interface StylistMessagePayload {
  message: string;
  imageUrl?: string;
  conversationId?: string;
  userContext?: {
    recentSignals?: {
      disliked?: string[];
    };
  };
}

interface StylistStreamHandlers {
  onConversationId?: (conversationId: string) => void;
  onToken?: (token: string) => void;
}

interface StylistMessageResult {
  text: string;
  suggestions: any[];
  conversationId?: string;
}

function buildStylistBody(payload: StylistMessagePayload) {
  const { user } = useAuthStore.getState();

  return {
    ...payload,
    userId: user?._id,
  };
}

function buildStylistHeaders(acceptStream = false) {
  const { token } = useAuthStore.getState();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (acceptStream) {
    headers.Accept = 'text/event-stream';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function normalizeStylistResult(result: any): StylistMessageResult {
  if (result?.message && !result?.reply) {
    throw new Error(result.message);
  }

  return {
    text: result?.reply || 'Sorry, Zaloga is thinking... try again.',
    suggestions: result?.suggestions || [],
    conversationId: result?.conversationId,
  };
}

async function readErrorMessage(response: Response) {
  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return data?.message || `Request failed with status ${response.status}`;
    }

    const text = await response.text();
    return text || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

function parseSseFrame(frame: string) {
  let event = 'message';
  const dataLines: string[] = [];

  frame.split(/\r?\n/).forEach((line) => {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^\s+/, ''));
    }
  });

  if (dataLines.length === 0) return null;

  try {
    return { event, data: JSON.parse(dataLines.join('\n')) };
  } catch {
    return { event, data: {} };
  }
}

function applySseFrame(frame: string, handlers: StylistStreamHandlers) {
  const parsed = parseSseFrame(frame);
  if (!parsed) return null;

  if (parsed.event === 'meta' && parsed.data?.conversationId) {
    handlers.onConversationId?.(parsed.data.conversationId);
    return null;
  }

  if (parsed.event === 'token') {
    handlers.onToken?.(parsed.data?.text || '');
    return null;
  }

  if (parsed.event === 'done') {
    return normalizeStylistResult(parsed.data);
  }

  if (parsed.event === 'error') {
    throw new Error(parsed.data?.message || 'Zaloga hit a snag. Try again.');
  }

  return null;
}

function parseSseText(text: string, handlers: StylistStreamHandlers): StylistMessageResult {
  let finalResult: StylistMessageResult | null = null;

  text.split(/\r?\n\r?\n/).forEach((frame) => {
    if (!frame.trim()) return;
    const result = applySseFrame(frame, handlers);
    if (result) finalResult = result;
  });

  return finalResult || { text: 'Sorry, Zaloga is thinking... try again.', suggestions: [] };
}

export async function sendStylistMessage(payload: StylistMessagePayload) {
  const result = await apiCall(AI_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify(buildStylistBody(payload)),
  });

  return normalizeStylistResult(result);
}

export async function sendStylistMessageStream(
  payload: StylistMessagePayload,
  handlers: StylistStreamHandlers = {}
): Promise<StylistMessageResult> {
  const response = await fetch(`${API_BASE_URL}${AI_ENDPOINT}`, {
    method: 'POST',
    headers: buildStylistHeaders(true),
    body: JSON.stringify(buildStylistBody(payload)),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream')) {
    return normalizeStylistResult(await response.json());
  }

  const reader = (response as any).body?.getReader?.();
  const TextDecoderImpl = (globalThis as any).TextDecoder;
  if (!reader || typeof TextDecoderImpl !== 'function') {
    return parseSseText(await response.text(), handlers);
  }

  const decoder = new TextDecoderImpl();
  let buffer = '';
  let finalResult: StylistMessageResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() || '';

    frames.forEach((frame) => {
      if (!frame.trim()) return;
      const result = applySseFrame(frame, handlers);
      if (result) finalResult = result;
    });
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    const result = applySseFrame(buffer, handlers);
    if (result) finalResult = result;
  }

  return finalResult || { text: 'Sorry, Zaloga is thinking... try again.', suggestions: [] };
}
