import { API_BASE_URL } from '@env';

export interface MockCall {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface MockReply {
  status: number;
  body?: unknown;
}

/** Handler for one "METHOD /path" route (path without the API base and query). */
export type MockRoute = (call: MockCall) => MockReply;

/**
 * Replaces global fetch with a fake Tailverse backend. Unknown routes answer 404.
 * Returns the recorded calls, in order.
 */
export function mockFetch(routes: Record<string, MockRoute>): MockCall[] {
  const calls: MockCall[] = [];
  const base = API_BASE_URL.replace(/\/+$/, '');

  jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    const path = url.slice(base.length).split('?')[0] ?? '';
    const method = init?.method ?? 'GET';
    const rawBody = init?.body;
    const call: MockCall = {
      method,
      path,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody,
    };
    calls.push(call);

    const route = routes[`${method} ${path}`];
    const reply: MockReply = route
      ? route(call)
      : { status: 404, body: { msg: 'not found', error: 'not found' } };
    return new Response(
      reply.body === undefined ? null : JSON.stringify(reply.body),
      {
        status: reply.status,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  });

  return calls;
}

export function json(status: number, body?: unknown): MockReply {
  return { status, body };
}

export const unauthorized = json(401, {
  msg: 'authentication required',
  error: 'token is expired: unauthorized',
});
