import { AppState, type AppStateStatus } from 'react-native';
import * as Keychain from 'react-native-keychain';

import { useAnnouncementsStore } from '../src/store/announcementsStore';
import { useAuthStore } from '../src/store/authStore';
import { useRealtimeStore } from '../src/store/realtimeStore';
import { useWalkSpotsStore } from '../src/store/walkSpotsStore';
import type { Announcement, WalkSpot } from '../src/types';
import { FakeWebSocket } from '../test-utils/fakeWebSocket';
import { json, mockFetch, unauthorized } from '../test-utils/mockFetch';

jest.useFakeTimers();

const addAppStateListener = jest.mocked(AppState.addEventListener);

const spot: WalkSpot = {
  id: 's1',
  name: 'Площадка у парка',
  lat: 47.9055,
  lng: 33.3905,
  tags: [],
  present_count: 1,
};

const announcement: Announcement = {
  id: 'a1',
  pet_id: 'p9',
  spot_id: 's1',
  custom_point: null,
  starts_at: new Date().toISOString(),
  duration_min: 60,
  status: 'active',
  created_at: new Date().toISOString(),
};

const initialAuth = useAuthStore.getState();
const initialSpots = useWalkSpotsStore.getState();

beforeEach(() => {
  jest.restoreAllMocks();
  (Keychain as unknown as { __resetKeychain: () => void }).__resetKeychain();
  useAuthStore.setState(
    {
      ...initialAuth,
      status: 'signedIn',
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    },
    true,
  );
  useWalkSpotsStore.setState({ ...initialSpots, spots: [spot] }, true);
  FakeWebSocket.reset();
  addAppStateListener.mockClear();
  (AppState as { currentState: unknown }).currentState = 'active';
});

afterEach(() => {
  useRealtimeStore.getState().disable();
  jest.clearAllTimers();
});

/** The AppState listener the realtime store registered. */
function appStateListener(): (state: AppStateStatus) => void {
  const call = addAppStateListener.mock.calls.at(-1);
  if (!call) {
    throw new Error('No AppState listener');
  }
  return call[1] as (state: AppStateStatus) => void;
}

/** Lets the mocked requests (and the Keychain writes after them) finish. */
async function flush() {
  const { setImmediate: realSetImmediate } = jest.requireActual('timers');
  for (let i = 0; i < 5; i++) {
    await new Promise(resolve => realSetImmediate(resolve));
  }
}

test('connects once when enabled while signed in', () => {
  useRealtimeStore.getState().enable();
  useRealtimeStore.getState().enable();

  expect(FakeWebSocket.instances).toHaveLength(1);
  const socket = FakeWebSocket.last();
  expect(socket.url).toBe('ws://localhost:8080/api/v1/ws/presence');
  expect(socket.headers).toEqual({ Authorization: 'Bearer access-1' });
  expect(useRealtimeStore.getState().status).toBe('connecting');

  socket.open();
  expect(useRealtimeStore.getState().status).toBe('open');
  expect(useRealtimeStore.getState().disconnectedSince).toBeNull();
});

test('never connects while signed out', () => {
  useAuthStore.setState({ status: 'signedOut', accessToken: null });
  useRealtimeStore.getState().enable();
  expect(FakeWebSocket.instances).toHaveLength(0);
  expect(useRealtimeStore.getState().enabled).toBe(false);
});

test('spot_update goes straight to the marker; announcement_created to the walks', () => {
  const applyAnnouncement = jest.spyOn(
    useAnnouncementsStore.getState(),
    'applyAnnouncementCreated',
  );
  useRealtimeStore.getState().enable();
  const socket = FakeWebSocket.last();
  socket.open();

  socket.receive({ type: 'spot_update', spot_id: 's1', present_count: 4 });
  expect(useWalkSpotsStore.getState().spots[0]?.present_count).toBe(4);

  socket.receive({ type: 'announcement_created', announcement });
  expect(applyAnnouncement).toHaveBeenCalledWith(announcement);

  // Nothing is fetched to complete a message.
  expect(jest.isMockFunction(globalThis.fetch)).toBe(false);
});

test('logout closes the connection and keeps it closed', async () => {
  useRealtimeStore.getState().enable();
  const socket = FakeWebSocket.last();
  socket.open();

  await useAuthStore.getState().logout();

  expect(socket.closedWith?.code).toBe(1000);
  expect(useRealtimeStore.getState()).toMatchObject({
    status: 'idle',
    enabled: false,
  });
  useRealtimeStore.getState().enable();
  jest.advanceTimersByTime(60_000);
  expect(FakeWebSocket.instances).toHaveLength(1);
});

test('closes in the background and reconnects (with a resync) in the foreground', () => {
  const refreshSpots = jest
    .spyOn(useWalkSpotsStore.getState(), 'refreshSpots')
    .mockResolvedValue();
  useRealtimeStore.getState().enable();
  const first = FakeWebSocket.last();
  first.open();
  expect(refreshSpots).not.toHaveBeenCalled();

  const onChange = appStateListener();
  onChange('inactive');
  expect(first.closedWith).toBeNull();

  onChange('background');
  expect(first.closedWith?.code).toBe(1000);
  expect(useRealtimeStore.getState().status).toBe('closed');
  jest.advanceTimersByTime(60_000);
  expect(FakeWebSocket.instances).toHaveLength(1);

  onChange('active');
  expect(FakeWebSocket.instances).toHaveLength(2);
  FakeWebSocket.last().open();
  expect(refreshSpots).toHaveBeenCalledTimes(1);
});

test('does not connect while the app is in the background', () => {
  (AppState as { currentState: unknown }).currentState = 'background';
  useRealtimeStore.getState().enable();
  expect(FakeWebSocket.instances).toHaveLength(0);

  appStateListener()('active');
  expect(FakeWebSocket.instances).toHaveLength(1);
});

test('after a dropped connection it reconnects and reloads the visible spots', async () => {
  const calls = mockFetch({
    'GET /walkspots': () =>
      json(200, { spots: [{ ...spot, present_count: 3 }] }),
  });
  useWalkSpotsStore.setState({
    spotsQuery: { center: { lat: spot.lat, lng: spot.lng }, radiusM: 1000 },
  });
  useRealtimeStore.getState().enable();
  FakeWebSocket.last().open();

  const before = Date.now();
  FakeWebSocket.last().drop();
  expect(useRealtimeStore.getState().status).toBe('reconnecting');
  expect(useRealtimeStore.getState().disconnectedSince).toBeGreaterThanOrEqual(
    before,
  );

  jest.advanceTimersByTime(1_000);
  FakeWebSocket.last().open();
  await flush();

  expect(calls.map(call => `${call.method} ${call.path}`)).toEqual([
    'GET /walkspots',
  ]);
  expect(useWalkSpotsStore.getState().spots[0]?.present_count).toBe(3);
  expect(useRealtimeStore.getState().disconnectedSince).toBeNull();
});

test('after a reconnect the walks list is resynced quietly with the walks missed meanwhile', async () => {
  const missed: Announcement = {
    ...announcement,
    id: 'a2',
    custom_point: { lat: 47.91, lng: 33.39 },
    spot_id: null,
  };
  let walks: Announcement[] = [announcement];
  let failList = false;
  const calls = mockFetch({
    'GET /walkspots': () => json(200, { spots: [spot] }),
    'GET /walkspots/s1': () => json(200, { ...spot, present: [] }),
    'GET /pets/p9': () => json(404, null),
    'GET /announcements': () =>
      failList ? json(500, null) : json(200, { announcements: walks }),
  });
  await useAnnouncementsStore
    .getState()
    .fetchAnnouncements({ lat: spot.lat, lng: spot.lng });
  expect(useAnnouncementsStore.getState().announcements).toHaveLength(1);

  useRealtimeStore.getState().enable();
  FakeWebSocket.last().open();
  // The walk is announced while the connection is down: its message never arrives.
  FakeWebSocket.last().drop();
  walks = [missed, announcement];
  const states: string[] = [];
  const unsubscribe = useAnnouncementsStore.subscribe(state =>
    states.push(`${state.status}/${state.refreshing}`),
  );
  jest.advanceTimersByTime(1_000);
  FakeWebSocket.last().open();
  await flush();
  unsubscribe();

  expect(calls.filter(call => call.path === '/announcements')).toHaveLength(2);
  expect(
    useAnnouncementsStore.getState().announcements.map(item => item.id),
  ).toEqual(['a2', 'a1']);
  // No spinner and no loading state while resyncing.
  expect(states.every(state => state === 'success/false')).toBe(true);

  // A failed resync keeps the list as it is.
  failList = true;
  FakeWebSocket.last().drop();
  jest.advanceTimersByTime(2_000);
  FakeWebSocket.last().open();
  await flush();
  expect(calls.filter(call => call.path === '/announcements')).toHaveLength(3);
  expect(useAnnouncementsStore.getState()).toMatchObject({
    status: 'success',
    error: null,
    refreshing: false,
  });
  expect(useAnnouncementsStore.getState().announcements).toHaveLength(2);
  useAnnouncementsStore.getState().reset();
});

test('a 401 handshake refreshes the session, then reconnects with the new token', async () => {
  const calls = mockFetch({
    'POST /auth/refresh': () =>
      json(200, { access_token: 'access-2', refresh_token: 'refresh-2' }),
  });
  useRealtimeStore.getState().enable();

  FakeWebSocket.last().reject401();
  await flush();

  expect(calls.map(call => call.path)).toEqual(['/auth/refresh']);
  expect(useAuthStore.getState().accessToken).toBe('access-2');
  expect(FakeWebSocket.instances).toHaveLength(2);
  expect(FakeWebSocket.last().headers.Authorization).toBe('Bearer access-2');
});

test('a 401 with a dead session logs out and stops reconnecting', async () => {
  mockFetch({ 'POST /auth/refresh': () => unauthorized });
  useRealtimeStore.getState().enable();

  FakeWebSocket.last().reject401();
  await flush();

  expect(useAuthStore.getState().status).toBe('signedOut');
  expect(useRealtimeStore.getState().status).toBe('idle');
  jest.advanceTimersByTime(60_000);
  expect(FakeWebSocket.instances).toHaveLength(1);
});
