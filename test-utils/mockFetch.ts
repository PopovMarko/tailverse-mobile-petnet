import { API_BASE_URL } from '@env';

export interface MockCall {
  method: string;
  path: string;
  /** Decoded query parameters. */
  query: Record<string, string>;
  headers: Record<string, string>;
  body: unknown;
}

export interface MockReply {
  status: number;
  body?: unknown;
}

/**
 * Handler for one "METHOD /path" route (path without the API base and query).
 * May return a promise to hold the response back (e.g. to test races).
 */
export type MockRoute = (call: MockCall) => MockReply | Promise<MockReply>;

/**
 * Replaces global fetch with a fake Tailverse backend. Unknown routes answer 404.
 * Returns the recorded calls, in order.
 */
export function mockFetch(routes: Record<string, MockRoute>): MockCall[] {
  const calls: MockCall[] = [];
  const base = API_BASE_URL.replace(/\/+$/, '');

  jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    const [path = '', search = ''] = url.slice(base.length).split('?');
    const query: Record<string, string> = {};
    for (const pair of search.split('&').filter(Boolean)) {
      const [key = '', value = ''] = pair.split('=');
      query[decodeURIComponent(key)] = decodeURIComponent(value);
    }
    const method = init?.method ?? 'GET';
    const rawBody = init?.body;
    const call: MockCall = {
      method,
      path,
      query,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody,
    };
    calls.push(call);

    const route = routes[`${method} ${path}`];
    const reply: MockReply = route
      ? await route(call)
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
