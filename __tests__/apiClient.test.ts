import { ApiError, request, setSessionHandler } from '../src/api/client';
import { json, mockFetch, unauthorized } from '../test-utils/mockFetch';

const refreshAccessToken = jest.fn<Promise<string | null>, []>();
let accessToken: string | null = 'old';

beforeEach(() => {
  jest.restoreAllMocks();
  refreshAccessToken.mockReset();
  accessToken = 'old';
  setSessionHandler({ getAccessToken: () => accessToken, refreshAccessToken });
});

afterAll(() => setSessionHandler(null));

test('auth requests send the session access token', async () => {
  const calls = mockFetch({ 'GET /pets': () => json(200, { pets: [] }) });

  await expect(request('/pets', { auth: true })).resolves.toEqual({
    pets: [],
  });
  expect(calls[0]?.headers.Authorization).toBe('Bearer old');
});

test('public requests send no Authorization header', async () => {
  const calls = mockFetch({ 'GET /walkspots': () => json(200, { spots: [] }) });

  await request('/walkspots');
  expect(calls[0]?.headers.Authorization).toBeUndefined();
});

test('a 401 refreshes the session once and retries with the new token', async () => {
  const calls = mockFetch({
    'GET /owners/me': call =>
      call.headers.Authorization === 'Bearer new'
        ? json(200, { id: 'o1' })
        : unauthorized,
  });
  refreshAccessToken.mockImplementation(async () => {
    accessToken = 'new';
    return 'new';
  });

  await expect(request('/owners/me', { auth: true })).resolves.toEqual({
    id: 'o1',
  });
  expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  expect(calls.map(call => call.headers.Authorization)).toEqual([
    'Bearer old',
    'Bearer new',
  ]);
});

test('a failed refresh surfaces the 401 without retrying', async () => {
  const calls = mockFetch({ 'GET /owners/me': () => unauthorized });
  refreshAccessToken.mockResolvedValue(null);

  const error = await request('/owners/me', { auth: true }).catch(e => e);
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).status).toBe(401);
  expect(calls).toHaveLength(1);
});

test('a 401 on the retry is not refreshed again', async () => {
  const calls = mockFetch({ 'GET /owners/me': () => unauthorized });
  refreshAccessToken.mockResolvedValue('new');

  await expect(request('/owners/me', { auth: true })).rejects.toThrow(ApiError);
  expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  expect(calls).toHaveLength(2);
});

test('reuses a token refreshed by a concurrent request instead of refreshing again', async () => {
  mockFetch({
    'GET /pets': call => {
      if (call.headers.Authorization === 'Bearer old') {
        accessToken = 'new'; // someone else refreshed meanwhile
        return unauthorized;
      }
      return json(200, { pets: [] });
    },
  });

  await expect(request('/pets', { auth: true })).resolves.toEqual({
    pets: [],
  });
  expect(refreshAccessToken).not.toHaveBeenCalled();
});

test('auth endpoints are not refreshed on 401 (wrong password)', async () => {
  mockFetch({
    'POST /auth/login': () =>
      json(401, { msg: 'Login handler', error: 'invalid email or password' }),
  });

  await expect(
    request('/auth/login', {
      method: 'POST',
      body: { email: 'a', password: 'b' },
    }),
  ).rejects.toMatchObject({ status: 401 });
  expect(refreshAccessToken).not.toHaveBeenCalled();
});

test('FormData bodies are sent as-is, without a JSON content type', async () => {
  const calls = mockFetch({
    'POST /uploads': () => json(201, { url: 'http://x/uploads/a.jpg' }),
  });
  const form = new FormData();

  await request('/uploads', { method: 'POST', body: form, auth: true });
  expect(calls[0]?.body).toBe(form);
  expect(calls[0]?.headers['Content-Type']).toBeUndefined();
});
