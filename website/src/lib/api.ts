// Shared fetch helper for the website. Pages can import `apiCall` and get
// sane defaults:
//   - Authorization: Bearer <token> from AuthContext (caller passes it)
//   - JSON content-type unless FormData
//   - Throws on non-2xx with the server's `{ message }` (or a generic one)
//   - Returns parsed JSON
//
// Existing pages do ad-hoc fetch + JSON.parse. This is the recommended
// pattern going forward; new code should use this and gradually migrate.
//
// The throw-on-error shape is the opposite of the Expo apiCall (which
// returns the error body). Reason: the website has an `error` state in
// every form and would rather catch and render the message.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export interface ApiError extends Error {
  status: number;
  body?: any;
}

export async function apiCall<T = any>(
  endpoint: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  if (!API_BASE_URL) {
    const err: ApiError = new Error(
      "API not configured. Set NEXT_PUBLIC_API_BASE_URL in website/.env.",
    ) as ApiError;
    err.status = 0;
    throw err;
  }

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let body = options.body;
  if (!(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      body,
      headers,
    });
  } catch (e: any) {
    const err: ApiError = new Error(
      `Network error reaching ${endpoint}: ${e?.message || e}`,
    ) as ApiError;
    err.status = 0;
    throw err;
  }

  // Try to parse JSON; fall back gracefully on empty or non-JSON bodies.
  const text = await response.text();
  let parsed: any = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { message: text };
    }
  }

  if (!response.ok) {
    const err: ApiError = new Error(
      parsed?.message || `Request failed (${response.status})`,
    ) as ApiError;
    err.status = response.status;
    err.body = parsed;
    throw err;
  }

  return parsed as T;
}
