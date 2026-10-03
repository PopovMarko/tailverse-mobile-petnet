import {
  PresenceSocket,
  STABLE_CONNECTION_MS,
  type ConnectionStatus,
  type PresenceSocketOptions,
} from '../src/services/presenceSocket';
import type { ServerMessage } from '../src/types';
import { FakeWebSocket } from '../test-utils/fakeWebSocket';

const URL = 'ws://localhost:8080/api/v1/ws/presence';

jest.useFakeTimers();

beforeEach(() => {
  FakeWebSocket.reset();
});

afterEach(() => {
  jest.clearAllTimers();
});

/** A connection with recorded callbacks; the longest backoff (random = 1) unless given. */
function setup(overrides: Partial<PresenceSocketOptions> = {}) {
  let token: string | null = 'access-1';
  const statuses: ConnectionStatus[] = [];
  const messages: ServerMessage[] = [];
  const onReconnected = jest.fn();
  const refreshAccessToken = jest.fn(async () => {
    token = 'access-2';
    return token;
  });
  const connection = new PresenceSocket({
    url: URL,
    getAccessToken: () => token,
    refreshAccessToken,
    onMessage: message => messages.push(message),
    onStatusChange: status => statuses.push(status),
    onReconnected,
    random: () => 1,
    ...overrides,
  });
  return {
    connection,
    statuses,
    messages,
    onReconnected,
    refreshAccessToken,
    setToken: (value: string | null) => {
      token = value;
    },
  };
}

/** Lets pending promise callbacks (the refresh) run. */
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

test('connects with the token in the Authorization header, not the URL', () => {
  const { connection, statuses } = setup();
  connection.start();

  const socket = FakeWebSocket.last();
  expect(socket.url).toBe(URL);
  expect(socket.headers).toEqual({ Authorization: 'Bearer access-1' });
  expect(connection.currentStatus).toBe('connecting');

  socket.open();
  expect(statuses).toEqual(['connecting', 'open']);
});

test('start() is idempotent: one socket at a time', () => {
  const { connection } = setup();
  connection.start();
  connection.start();
  FakeWebSocket.last().open();
  connection.start();
  expect(FakeWebSocket.instances).toHaveLength(1);
});

test('hands valid messages over and drops the rest', () => {
  const { connection, messages } = setup();
  connection.start();
  const socket = FakeWebSocket.last();
  socket.open();

  socket.receive({ type: 'spot_update', spot_id: 's1', present_count: 2 });
  socket.receive('not json');
  socket.receive({ type: 'post_created', post: {} });
  socket.receive({ type: 'spot_update', spot_id: 's1' });

  expect(messages).toEqual([
    { type: 'spot_update', spot_id: 's1', present_count: 2 },
  ]);
});

test('reconnects with exponential backoff while the server is unreachable', () => {
  const { connection, statuses } = setup();
  connection.start();

  // random = 1: the longest delays of each step.
  const expected = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000];
  for (const delay of expected) {
    const count = FakeWebSocket.instances.length;
    FakeWebSocket.last().fail();
    expect(connection.currentStatus).toBe('reconnecting');

    jest.advanceTimersByTime(delay - 1);
    expect(FakeWebSocket.instances).toHaveLength(count);
    jest.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(count + 1);
  }
  expect(FakeWebSocket.live()).toHaveLength(1);
  expect(statuses).toEqual(['connecting', 'reconnecting']);
});

test('a connection that keeps dropping right after opening still backs off', () => {
  const { connection } = setup();
  connection.start();

  for (const delay of [1_000, 2_000, 4_000]) {
    const socket = FakeWebSocket.last();
    socket.open();
    socket.drop();
    const count = FakeWebSocket.instances.length;
    jest.advanceTimersByTime(delay - 1);
    expect(FakeWebSocket.instances).toHaveLength(count);
    jest.advanceTimersByTime(1);
  }
});

test('a stable connection starts the backoff over', () => {
  const { connection } = setup();
  connection.start();
  FakeWebSocket.last().fail();
  jest.advanceTimersByTime(1_000);
  FakeWebSocket.last().fail();
  jest.advanceTimersByTime(2_000);

  const socket = FakeWebSocket.last();
  socket.open();
  jest.advanceTimersByTime(STABLE_CONNECTION_MS);
  socket.drop();

  const count = FakeWebSocket.instances.length;
  jest.advanceTimersByTime(1_000);
  expect(FakeWebSocket.instances).toHaveLength(count + 1);
});

test('reports a reconnect only after having been open before', () => {
  const { connection, onReconnected } = setup();
  connection.start();
  FakeWebSocket.last().fail();
  jest.advanceTimersByTime(1_000);
  FakeWebSocket.last().open();
  expect(onReconnected).not.toHaveBeenCalled();

  // Open only briefly: the backoff has grown to its second step.
  FakeWebSocket.last().drop();
  jest.advanceTimersByTime(2_000);
  FakeWebSocket.last().open();
  expect(onReconnected).toHaveBeenCalledTimes(1);

  // Also after stop/start (e.g. back from the background).
  connection.stop();
  connection.start();
  FakeWebSocket.last().open();
  expect(onReconnected).toHaveBeenCalledTimes(2);
});

test('401: refreshes the session once and reconnects right away', async () => {
  const { connection, refreshAccessToken, statuses } = setup();
  connection.start();

  FakeWebSocket.last().reject401();
  await flush();

  expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  expect(FakeWebSocket.instances).toHaveLength(2);
  expect(FakeWebSocket.last().headers.Authorization).toBe('Bearer access-2');

  FakeWebSocket.last().open();
  expect(statuses).toEqual(['connecting', 'reconnecting', 'open']);
});

test('401 again with the fresh token: backs off instead of refreshing in a loop', async () => {
  const { connection, refreshAccessToken } = setup();
  connection.start();
  FakeWebSocket.last().reject401();
  await flush();

  FakeWebSocket.last().reject401();
  await flush();
  expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  expect(FakeWebSocket.instances).toHaveLength(2);

  jest.advanceTimersByTime(999);
  expect(FakeWebSocket.instances).toHaveLength(2);
  jest.advanceTimersByTime(1);
  expect(FakeWebSocket.instances).toHaveLength(3);

  // A later attempt (after the backoff) may refresh again, at most once per step.
  FakeWebSocket.last().reject401();
  await flush();
  expect(refreshAccessToken).toHaveBeenCalledTimes(2);
});

test('401 after the token was refreshed elsewhere: just uses the new one', async () => {
  const { connection, refreshAccessToken, setToken } = setup();
  connection.start();
  setToken('access-from-rest');

  FakeWebSocket.last().reject401();
  await flush();

  expect(refreshAccessToken).not.toHaveBeenCalled();
  expect(FakeWebSocket.last().headers.Authorization).toBe(
    'Bearer access-from-rest',
  );
});

test('401 and the session is gone: stops for good', async () => {
  const { connection } = setup({
    refreshAccessToken: jest.fn(async () => null),
  });
  connection.start();

  FakeWebSocket.last().reject401();
  await flush();

  expect(connection.currentStatus).toBe('closed');
  jest.advanceTimersByTime(60_000);
  expect(FakeWebSocket.instances).toHaveLength(1);
});

test('401 while offline (refresh fails): retries later with backoff', async () => {
  const refreshAccessToken = jest
    .fn<Promise<string | null>, []>()
    .mockRejectedValueOnce(new TypeError('Network request failed'));
  const { connection } = setup({ refreshAccessToken });
  connection.start();

  FakeWebSocket.last().reject401();
  await flush();
  expect(FakeWebSocket.instances).toHaveLength(1);
  expect(connection.currentStatus).toBe('reconnecting');

  jest.advanceTimersByTime(1_000);
  expect(FakeWebSocket.instances).toHaveLength(2);
});

test('stop() closes the socket, cancels the retry and ignores late events', () => {
  const { connection, messages } = setup();
  connection.start();
  const first = FakeWebSocket.last();
  first.open();
  connection.stop();

  expect(first.closedWith).toEqual({ code: 1000, reason: 'client closed' });
  expect(connection.currentStatus).toBe('closed');
  first.receive({ type: 'spot_update', spot_id: 's1', present_count: 1 });
  expect(messages).toEqual([]);

  connection.start();
  FakeWebSocket.last().fail();
  connection.stop();
  jest.advanceTimersByTime(60_000);
  expect(FakeWebSocket.instances).toHaveLength(2);
});

test('stop() during a refresh: no reconnect when it resolves', async () => {
  let resolve: (token: string) => void = () => {};
  const { connection } = setup({
    refreshAccessToken: () => new Promise(r => (resolve = r)),
  });
  connection.start();
  FakeWebSocket.last().reject401();
  connection.stop();

  resolve('access-2');
  await flush();
  expect(FakeWebSocket.instances).toHaveLength(1);
  expect(connection.currentStatus).toBe('closed');
});

test('does not connect without a token', () => {
  const { connection, setToken } = setup();
  setToken(null);
  connection.start();
  expect(FakeWebSocket.instances).toHaveLength(0);
  expect(connection.currentStatus).toBe('idle');
});
