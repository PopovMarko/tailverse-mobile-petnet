import { API_BASE_URL } from '@env';

import type { ApiErrorBody } from '../types';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  /** Sent as JSON, or as multipart/form-data when it is a FormData. */
  body?: unknown;
  /**
   * Send the signed-in session's access token ("Authorization: Bearer ...").
   * On 401 the session is refreshed once and the request retried; if the refresh
   * fails the session handler signs the user out and the 401 ApiError is thrown.
   */
  auth?: boolean;
  /** Explicit access token; takes precedence over `auth` and is never refreshed. */
  token?: string;
  query?: Record<string, string | number | undefined>;
}

/** Thrown for any non-2xx response; carries the backend's { msg, error } body. */
export class ApiError extends Error {
  constructor(readonly status: number, readonly body: ApiErrorBody | null) {
    super(body?.error ?? `HTTP ${status}`);
    this.name = 'ApiError';
  }
}

/**
 * Bridge to the session store (registered by store/authStore), so the API layer
 * can read and refresh tokens without importing the store.
 */
export interface SessionHandler {
  getAccessToken: () => string | null;
  /** Resolves to a fresh access token, or null when the session is gone. */
  refreshAccessToken: () => Promise<string | null>;
}

let sessionHandler: SessionHandler | null = null;

export function setSessionHandler(handler: SessionHandler | null) {
  sessionHandler = handler;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}${path}`;
  if (!query) {
    return url;
  }
  const params = Object.entries(query)
    .filter(
      (entry): entry is [string, string | number] => entry[1] !== undefined,
    )
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join('&');
  return params ? `${url}?${params}` : url;
}

function send(
  path: string,
  options: RequestOptions,
  token: string | null | undefined,
): Promise<Response> {
  const { method = 'GET', body, query } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  let payload: string | FormData | undefined;
  if (body instanceof FormData) {
    // fetch sets multipart/form-data with the boundary itself.
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(buildUrl(path, query), { method, headers, body: payload });
}

/**
 * Sends a request to the Tailverse API.
 * `path` is relative to API_BASE_URL, e.g. "/pets" or "/walkspots/123".
 * Resolves to undefined for 204 No Content responses.
 */
export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const useSession = options.auth === true && options.token === undefined;
  const token = useSession ? sessionHandler?.getAccessToken() : options.token;

  let response = await send(path, options, token);

  if (response.status === 401 && useSession && sessionHandler) {
    // Another request may have refreshed the session meanwhile; reuse its token.
    const current = sessionHandler.getAccessToken();
    const fresh =
      current && current !== token
        ? current
        : await sessionHandler.refreshAccessToken();
    if (fresh) {
      response = await send(path, options, fresh);
    }
  }

  if (!response.ok) {
    const errorBody = (await response
      .json()
      .catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(response.status, errorBody);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
