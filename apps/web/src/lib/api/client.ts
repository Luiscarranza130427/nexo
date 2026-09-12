import type { AuthTokens } from '@nexo/types';
import { ApiError, networkError, normalizeApiError } from './errors';

/**
 * Centralized HTTP client.
 *
 * Nothing in the application calls `fetch` directly: credentials, headers,
 * error normalization and token refresh all belong here, in one place.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * The access token lives **in memory only**.
 *
 * Never localStorage, sessionStorage or IndexedDB — anything a script can read,
 * an injected script can exfiltrate. Losing it on reload is intended: the
 * HttpOnly refresh cookie is what restores the session.
 */
let accessToken: string | null = null;

/** In-flight refresh, so concurrent callers share one round trip. */
let refreshInFlight: Promise<AuthTokens | null> | null = null;

/** Called when the session is definitively gone, so the app can reset and redirect. */
let onSessionLost: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setSessionLostHandler(handler: (() => void) | null): void {
  onSessionLost = handler;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Internal: prevents a refreshed request from trying to refresh again. */
  skipRefresh?: boolean;
  signal?: AbortSignal;
};

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    // A non-JSON body (an HTML error page from a proxy, say) must not crash the
    // client; it becomes an opaque body on a normalized error instead.
    return text;
  }
}

async function rawRequest(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  try {
    return await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      // Sends and receives the HttpOnly refresh cookie. The frontend never
      // reads that cookie — only the browser and the API touch it.
      credentials: 'include',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (cause) {
    throw networkError(cause);
  }
}

/**
 * Rotates the refresh token, at most once at a time.
 *
 * Sharing one promise is not just an optimization, it is a correctness
 * requirement. Refresh **rotates** the token, so two concurrent calls would
 * both present the same cookie: the first rotates it, the second arrives with a
 * token the server has already replaced, and the API — correctly — treats that
 * as reuse and revokes the whole session. Every caller therefore waits on the
 * same request: the bootstrap, a 401 retry, or several of them at once.
 *
 * Returns the full session, not just the token, so the caller restoring a
 * session does not need a second `/auth/me` round trip.
 */
export function refreshSession(): Promise<AuthTokens | null> {
  refreshInFlight ??= (async () => {
    try {
      const response = await rawRequest('/auth/refresh', { method: 'POST', skipRefresh: true });

      if (!response.ok) {
        return null;
      }

      const body = (await parseBody(response)) as AuthTokens | null;

      return typeof body?.accessToken === 'string' ? body : null;
    } catch {
      return null;
    } finally {
      // Cleared in `finally` so a failed refresh does not wedge the client.
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * Performs a request, transparently refreshing an expired access token once.
 *
 * The retry happens at most once per request, and the refresh itself never
 * retries, so there is no path back into this function that could loop.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await rawRequest(path, options);

  if (response.status === 401 && !options.skipRefresh) {
    const session = await refreshSession();

    if (session) {
      setAccessToken(session.accessToken);
      response = await rawRequest(path, { ...options, skipRefresh: true });
    } else {
      setAccessToken(null);
      onSessionLost?.();
    }
  }

  const body = await parseBody(response);

  if (!response.ok) {
    throw normalizeApiError(response.status, body);
  }

  return body as T;
}

export { ApiError };
