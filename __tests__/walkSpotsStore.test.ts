import { getWalkSpot, listWalkSpots } from '../src/api';
import { useWalkSpotsStore } from '../src/store/walkSpotsStore';
import type { WalkSpot, WalkSpotDetails } from '../src/types';

jest.mock('../src/api', () => ({
  listWalkSpots: jest.fn(),
  getWalkSpot: jest.fn(),
}));

const listMock = jest.mocked(listWalkSpots);
const getMock = jest.mocked(getWalkSpot);

const center = { lat: 55.75, lng: 37.61 };

function spot(id: string): WalkSpot {
  return { id, name: id, lat: 0, lng: 0, tags: [], present_count: 0 };
}

function details(id: string): WalkSpotDetails {
  return { id, name: id, lat: 0, lng: 0, tags: [], present: [] };
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

const initialState = useWalkSpotsStore.getState();

beforeEach(() => {
  useWalkSpotsStore.setState(initialState, true);
  jest.resetAllMocks();
});

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

test('clearSelection resets the selected spot', async () => {
  getMock.mockResolvedValue(details('a'));
  await useWalkSpotsStore.getState().selectSpot('a');

  useWalkSpotsStore.getState().clearSelection();

  const state = useWalkSpotsStore.getState();
  expect(state.selectedSpotId).toBeNull();
  expect(state.selectedSpot).toBeNull();
  expect(state.selectedStatus).toBe('idle');
});
