import { API_BASE_URL } from '@env';

import type { ApiErrorBody } from '../types';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  /** Access token; sent as "Authorization: Bearer <token>". */
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

/**
 * Sends a JSON request to the Tailverse API.
 * `path` is relative to API_BASE_URL, e.g. "/pets" or "/walkspots/123".
 * Resolves to undefined for 204 No Content responses.
 */
export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, token, query } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

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
