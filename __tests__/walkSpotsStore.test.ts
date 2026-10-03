import {
  ApiError,
  checkIn,
  checkOut,
  getWalkSpot,
  listWalkSpots,
} from '../src/api';
import { useAuthStore } from '../src/store/authStore';
import { activeCheckIn, useWalkSpotsStore } from '../src/store/walkSpotsStore';
import type {
  CheckInResponse,
  PresentPet,
  WalkSpot,
  WalkSpotDetails,
} from '../src/types';

jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  listWalkSpots: jest.fn(),
  getWalkSpot: jest.fn(),
  checkIn: jest.fn(),
  checkOut: jest.fn(),
}));

const listMock = jest.mocked(listWalkSpots);
const getMock = jest.mocked(getWalkSpot);
const checkInMock = jest.mocked(checkIn);
const checkOutMock = jest.mocked(checkOut);

const center = { lat: 55.75, lng: 37.61 };

function spot(id: string, presentCount = 0): WalkSpot {
  return {
    id,
    name: id,
    lat: 0,
    lng: 0,
    tags: [],
    present_count: presentCount,
  };
}

function present(petId: string): PresentPet {
  return {
    pet_id: petId,
    pet_name: petId,
    owner_nickname: 'owner',
    checked_in_at: '2026-10-03T10:00:00Z',
  };
}

function details(id: string, petIds: string[] = []): WalkSpotDetails {
  return {
    id,
    name: id,
    lat: 0,
    lng: 0,
    tags: [],
    present: petIds.map(present),
  };
}

function checkInEntry(spotId: string, petId: string): CheckInResponse {
  return {
    spot_id: spotId,
    pet_id: petId,
    checked_in_at: '2026-10-03T10:00:00Z',
    expires_at: '2999-01-01T00:00:00Z',
  };
}

/** A promise plus the functions to settle it from the test. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise<void>(resolve => setImmediate(resolve));

const initialState = useWalkSpotsStore.getState();
const initialAuthState = useAuthStore.getState();

beforeEach(() => {
  useWalkSpotsStore.setState(initialState, true);
  useAuthStore.setState(initialAuthState, true);
  jest.resetAllMocks();
});

/** A loaded map with spot "a" (1 pet) and "b" (0), and "a" open in the sheet. */
async function openSpotA() {
  listMock.mockResolvedValue({ spots: [spot('a', 1), spot('b')] });
  getMock.mockResolvedValue(details('a', ['other']));
  await useWalkSpotsStore.getState().fetchSpots(center, 1000);
  await useWalkSpotsStore.getState().selectSpot('a');
  jest.resetAllMocks();
}

test('fetchSpots stores the spots on success', async () => {
  listMock.mockResolvedValue({ spots: [spot('a')] });

  await useWalkSpotsStore.getState().fetchSpots(center, 1000);

  expect(listMock).toHaveBeenCalledWith(center, 1000);
  const state = useWalkSpotsStore.getState();
  expect(state.spotsStatus).toBe('success');
  expect(state.spots).toEqual([spot('a')]);
});

test('fetchSpots keeps only the latest response when requests finish out of order', async () => {
  const first = deferred<{ spots: WalkSpot[] }>();
  const second = deferred<{ spots: WalkSpot[] }>();
  listMock
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);

  const { fetchSpots } = useWalkSpotsStore.getState();
  const firstCall = fetchSpots(center, 1000);
  const secondCall = fetchSpots(center, 2000);

  second.resolve({ spots: [spot('new')] });
  await secondCall;
  first.resolve({ spots: [spot('stale')] });
  await firstCall;

  expect(useWalkSpotsStore.getState().spots).toEqual([spot('new')]);
});

test('fetchSpots records the error message on failure', async () => {
  listMock.mockRejectedValue(new Error('network down'));

  await useWalkSpotsStore.getState().fetchSpots(center, 1000);

  const state = useWalkSpotsStore.getState();
  expect(state.spotsStatus).toBe('error');
  expect(state.spotsError).toBe('network down');
});

test('selectSpot ignores a response for a spot that is no longer selected', async () => {
  const slow = deferred<WalkSpotDetails>();
  getMock.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(details('b'));

  const { selectSpot } = useWalkSpotsStore.getState();
  const selectA = selectSpot('a');
  await selectSpot('b');
  slow.resolve(details('a'));
  await selectA;

  const state = useWalkSpotsStore.getState();
  expect(state.selectedSpotId).toBe('b');
  expect(state.selectedSpot).toEqual(details('b'));
});

test('selectSpot brings the marker count in line with the fresh details', async () => {
  listMock.mockResolvedValue({ spots: [spot('a', 0)] });
  getMock.mockResolvedValue(details('a', ['p1', 'p2']));

  await useWalkSpotsStore.getState().fetchSpots(center, 1000);
  await useWalkSpotsStore.getState().selectSpot('a');

  expect(useWalkSpotsStore.getState().spots).toEqual([spot('a', 2)]);
});

test('clearSelection resets the selected spot', async () => {
  getMock.mockResolvedValue(details('a'));
  await useWalkSpotsStore.getState().selectSpot('a');

  useWalkSpotsStore.getState().clearSelection();

  const state = useWalkSpotsStore.getState();
  expect(state.selectedSpotId).toBeNull();
  expect(state.selectedSpot).toBeNull();
  expect(state.selectedStatus).toBe('idle');
});

test('applySpotUpdate updates the marker count and ignores unknown spots', async () => {
  await openSpotA();
  const before = useWalkSpotsStore.getState().spots;

  useWalkSpotsStore.getState().applySpotUpdate('unknown', 5);
  expect(useWalkSpotsStore.getState().spots).toBe(before);

  useWalkSpotsStore.getState().applySpotUpdate('b', 3);
  expect(useWalkSpotsStore.getState().spots).toEqual([
    spot('a', 1),
    spot('b', 3),
  ]);
  // Spot "b" is not open, so its details are not fetched.
  expect(getMock).not.toHaveBeenCalled();
});

test('applySpotUpdate reloads the open sheet when its count changes', async () => {
  await openSpotA();
  getMock.mockResolvedValue(details('a', ['other', 'newcomer']));

  useWalkSpotsStore.getState().applySpotUpdate('a', 2);
  await flush();

  expect(getMock).toHaveBeenCalledWith('a');
  const state = useWalkSpotsStore.getState();
  expect(state.selectedSpot?.present.map(pet => pet.pet_id)).toEqual([
    'other',
    'newcomer',
  ]);
  expect(state.spots[0]).toEqual(spot('a', 2));
});

test('applySpotUpdate does not reload the open sheet when the count matches', async () => {
  await openSpotA();

  useWalkSpotsStore.getState().applySpotUpdate('a', 1);
  await flush();

  expect(getMock).not.toHaveBeenCalled();
});

test('checkIn records the check-in and refreshes the sheet and markers', async () => {
  await openSpotA();
  checkInMock.mockResolvedValue(checkInEntry('a', 'p1'));
  getMock.mockResolvedValue(details('a', ['other', 'p1']));
  listMock.mockResolvedValue({ spots: [spot('a', 2), spot('b')] });

  const ok = await useWalkSpotsStore.getState().checkIn('a', 'p1');

  expect(ok).toBe(true);
  expect(checkInMock).toHaveBeenCalledWith('a', 'p1');
  expect(listMock).toHaveBeenCalledWith(center, 1000);
  const state = useWalkSpotsStore.getState();
  expect(state.myCheckIns).toEqual({ p1: checkInEntry('a', 'p1') });
  expect(state.selectedSpot?.present).toHaveLength(2);
  expect(state.spots[0]?.present_count).toBe(2);
  expect(state.presencePending).toBeNull();
  // A silent refresh: no loading spinner.
  expect(state.spotsStatus).toBe('success');
});

test('checkIn shows a Russian error and keeps the state on failure', async () => {
  await openSpotA();
  checkInMock.mockRejectedValue(
    new ApiError(403, { msg: 'CheckIn', error: 'forbidden' }),
  );

  const ok = await useWalkSpotsStore.getState().checkIn('a', 'p1');

  expect(ok).toBe(false);
  const state = useWalkSpotsStore.getState();
  expect(state.presenceError).toBe('Можно отмечать только своих питомцев');
  expect(state.presencePending).toBeNull();
  expect(state.myCheckIns).toEqual({});
});

test('checkOut treats "not checked in" (404) as already done', async () => {
  await openSpotA();
  useWalkSpotsStore.setState({ myCheckIns: { p1: checkInEntry('a', 'p1') } });
  checkOutMock.mockRejectedValue(
    new ApiError(404, { msg: 'CheckOut', error: 'not found' }),
  );
  getMock.mockResolvedValue(details('a'));
  listMock.mockResolvedValue({ spots: [spot('a', 0), spot('b')] });

  const ok = await useWalkSpotsStore.getState().checkOut('a', 'p1');

  expect(ok).toBe(true);
  expect(checkOutMock).toHaveBeenCalledWith('a', 'p1');
  const state = useWalkSpotsStore.getState();
  expect(state.myCheckIns).toEqual({});
  expect(state.presenceError).toBeNull();
  expect(state.spots[0]?.present_count).toBe(0);
});

test('activeCheckIn ignores expired check-ins', () => {
  const entry = {
    ...checkInEntry('a', 'p1'),
    expires_at: '2026-10-03T12:00:00Z',
  };
  const checkIns = { p1: entry };

  expect(activeCheckIn(checkIns, 'p1', new Date('2026-10-03T11:59:00Z'))).toBe(
    entry,
  );
  expect(
    activeCheckIn(checkIns, 'p1', new Date('2026-10-03T12:00:01Z')),
  ).toBeNull();
  expect(activeCheckIn(checkIns, 'p2')).toBeNull();
});

test('logging out clears the per-user state', async () => {
  await openSpotA();
  useWalkSpotsStore.setState({ myCheckIns: { p1: checkInEntry('a', 'p1') } });
  useAuthStore.setState({ status: 'signedIn' });

  useAuthStore.setState({ status: 'signedOut' });

  const state = useWalkSpotsStore.getState();
  expect(state.myCheckIns).toEqual({});
  expect(state.selectedSpotId).toBeNull();
  expect(state.spots).toEqual([]);
});

test('a check-in finishing after logout does not write back', async () => {
  await openSpotA();
  const slow = deferred<CheckInResponse>();
  checkInMock.mockReturnValue(slow.promise);
  useAuthStore.setState({ status: 'signedIn' });

  const call = useWalkSpotsStore.getState().checkIn('a', 'p1');
  useAuthStore.setState({ status: 'signedOut' });
  slow.resolve(checkInEntry('a', 'p1'));

  expect(await call).toBe(false);
  expect(useWalkSpotsStore.getState().myCheckIns).toEqual({});
  expect(getMock).not.toHaveBeenCalled();
});
