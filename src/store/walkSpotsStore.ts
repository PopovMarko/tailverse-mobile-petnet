import { create } from 'zustand';

import {
  checkIn as checkInRequest,
  checkOut as checkOutRequest,
  getWalkSpot,
  listWalkSpots,
  ApiError,
} from '../api';
import type {
  CheckInResponse,
  GeoPoint,
  Id,
  WalkSpot,
  WalkSpotDetails,
} from '../types';
import { describeError } from '../utils/errors';
import { removedPetIds, useAuthStore } from './authStore';

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

export type PresenceAction = 'checkIn' | 'checkOut';

interface WalkSpotsState {
  spots: WalkSpot[];
  spotsStatus: LoadStatus;
  spotsError: string | null;
  /** The area of the last fetchSpots, reused to refresh the markers. */
  spotsQuery: { center: GeoPoint; radiusM: number } | null;

  selectedSpotId: Id | null;
  selectedSpot: WalkSpotDetails | null;
  selectedStatus: LoadStatus;
  selectedError: string | null;

  /**
   * Check-ins made from this device in this session, by pet id. The backend has
   * no "where is my pet" endpoint, so this is how the app knows a pet is checked
   * in somewhere else. The present list of a spot is the source of truth for that spot.
   */
  myCheckIns: Record<Id, CheckInResponse>;
  /** The check-in/out request in flight, if any. */
  presencePending: { petId: Id; action: PresenceAction } | null;
  presenceError: string | null;

  fetchSpots: (center: GeoPoint, radiusM: number) => Promise<void>;
  /** Reloads the markers of the last area without the loading state. */
  refreshSpots: () => Promise<void>;
  selectSpot: (id: Id) => Promise<void>;
  /** Reloads the open spot's details in place (no loading state). */
  refreshSelectedSpot: () => Promise<void>;
  clearSelection: () => void;

  /** "I'm here with <pet>": POST checkin, then refreshes the spot and markers. Resolves to success. */
  checkIn: (spotId: Id, petId: Id) => Promise<boolean>;
  /** The pet has left: DELETE checkin, then refreshes. Resolves to success. */
  checkOut: (spotId: Id, petId: Id) => Promise<boolean>;

  /**
   * A spot's live pet count changed (realtime `spot_update` message, or any other
   * fresh source). Updates the marker; reloads the open sheet when it shows that
   * spot with a different number of pets. Unknown spots are ignored.
   */
  applySpotUpdate: (spotId: Id, presentCount: number) => void;

  /** Forgets everything, e.g. on logout. */
  reset: () => void;
}

/** The pet's check-in made here, unless it has expired by `now`. */
export function activeCheckIn(
  checkIns: Record<Id, CheckInResponse>,
  petId: Id,
  now: Date = new Date(),
): CheckInResponse | null {
  const entry = checkIns[petId];
  return entry && Date.parse(entry.expires_at) > now.getTime() ? entry : null;
}

const PRESENCE_ERRORS = {
  403: 'Можно отмечать только своих питомцев',
  404: 'Место или питомец не найдены',
};

// Panning the map fires requests faster than they complete; only the latest one may write.
let latestSpotsRequest = 0;
// Bumped by reset(): responses to requests started before a logout are dropped.
let generation = 0;

const initialState = {
  spots: [],
  spotsStatus: 'idle',
  spotsError: null,
  spotsQuery: null,

  selectedSpotId: null,
  selectedSpot: null,
  selectedStatus: 'idle',
  selectedError: null,

  myCheckIns: {},
  presencePending: null,
  presenceError: null,
} satisfies Partial<WalkSpotsState>;

export const useWalkSpotsStore = create<WalkSpotsState>()((set, get) => {
  /** Sets one marker's count; keeps the same array when nothing changes. */
  function setSpotCount(spotId: Id, presentCount: number) {
    set(state => {
      const index = state.spots.findIndex(spot => spot.id === spotId);
      if (index < 0 || state.spots[index]?.present_count === presentCount) {
        return state;
      }
      const spots = state.spots.slice();
      spots[index] = { ...state.spots[index]!, present_count: presentCount };
      return { spots };
    });
  }

  async function refreshAfterPresenceChange() {
    await Promise.all([get().refreshSelectedSpot(), get().refreshSpots()]);
  }

  return {
    ...initialState,

    fetchSpots: async (center, radiusM) => {
      const requestId = ++latestSpotsRequest;
      set({
        spotsStatus: 'loading',
        spotsError: null,
        spotsQuery: { center, radiusM },
      });
      try {
        const { spots } = await listWalkSpots(center, radiusM);
        if (requestId === latestSpotsRequest) {
          set({ spots, spotsStatus: 'success' });
        }
      } catch (error) {
        if (requestId === latestSpotsRequest) {
          set({ spotsStatus: 'error', spotsError: describeError(error) });
        }
      }
    },

    refreshSpots: async () => {
      const query = get().spotsQuery;
      if (!query) {
        return;
      }
      const requestId = ++latestSpotsRequest;
      try {
        const { spots } = await listWalkSpots(query.center, query.radiusM);
        if (requestId === latestSpotsRequest) {
          set({ spots, spotsStatus: 'success', spotsError: null });
        }
      } catch {
        // Keep the markers we have; the next pan or update fixes them.
        if (
          requestId === latestSpotsRequest &&
          get().spotsStatus === 'loading'
        ) {
          set({ spotsStatus: 'success' });
        }
      }
    },

    selectSpot: async id => {
      set({
        selectedSpotId: id,
        selectedSpot: null,
        selectedStatus: 'loading',
        selectedError: null,
        presenceError: null,
      });
      try {
        const spot = await getWalkSpot(id);
        if (get().selectedSpotId === id) {
          set({ selectedSpot: spot, selectedStatus: 'success' });
          setSpotCount(id, spot.present.length);
        }
      } catch (error) {
        if (get().selectedSpotId === id) {
          set({
            selectedStatus: 'error',
            selectedError: describeError(error, {
              404: 'Место не найдено',
            }),
          });
        }
      }
    },

    refreshSelectedSpot: async () => {
      const id = get().selectedSpotId;
      if (!id || get().selectedStatus === 'loading') {
        return;
      }
      try {
        const spot = await getWalkSpot(id);
        if (get().selectedSpotId === id) {
          set({ selectedSpot: spot, selectedStatus: 'success' });
          setSpotCount(id, spot.present.length);
        }
      } catch {
        // Keep showing the previous details.
      }
    },

    clearSelection: () =>
      set({
        selectedSpotId: null,
        selectedSpot: null,
        selectedStatus: 'idle',
        selectedError: null,
        presenceError: null,
      }),

    checkIn: async (spotId, petId) => {
      const started = generation;
      set({
        presencePending: { petId, action: 'checkIn' },
        presenceError: null,
      });
      try {
        const entry = await checkInRequest(spotId, petId);
        if (started !== generation) {
          return false;
        }
        set(state => ({
          myCheckIns: { ...state.myCheckIns, [petId]: entry },
        }));
        await refreshAfterPresenceChange();
        return true;
      } catch (error) {
        if (started === generation) {
          set({ presenceError: describeError(error, PRESENCE_ERRORS) });
        }
        return false;
      } finally {
        if (started === generation) {
          set({ presencePending: null });
        }
      }
    },

    checkOut: async (spotId, petId) => {
      const started = generation;
      set({
        presencePending: { petId, action: 'checkOut' },
        presenceError: null,
      });
      try {
        try {
          await checkOutRequest(spotId, petId);
        } catch (error) {
          // 404: the pet is not there any more (expired or checked in elsewhere) — already done.
          if (!(error instanceof ApiError && error.status === 404)) {
            throw error;
          }
        }
        if (started !== generation) {
          return false;
        }
        set(state => {
          if (state.myCheckIns[petId]?.spot_id !== spotId) {
            return state;
          }
          const myCheckIns = { ...state.myCheckIns };
          delete myCheckIns[petId];
          return { myCheckIns };
        });
        await refreshAfterPresenceChange();
        return true;
      } catch (error) {
        if (started === generation) {
          set({
            presenceError: describeError(error, {
              403: PRESENCE_ERRORS[403],
            }),
          });
        }
        return false;
      } finally {
        if (started === generation) {
          set({ presencePending: null });
        }
      }
    },

    applySpotUpdate: (spotId, presentCount) => {
      setSpotCount(spotId, presentCount);
      const { selectedSpotId, selectedSpot } = get();
      if (
        selectedSpotId === spotId &&
        selectedSpot &&
        selectedSpot.present.length !== presentCount
      ) {
        get().refreshSelectedSpot();
      }
    },

    reset: () => {
      generation++;
      latestSpotsRequest++;
      set(initialState);
    },
  };
});

// Check-ins and the open sheet belong to the signed-in owner; a deleted pet's
// check-in is gone with it.
useAuthStore.subscribe((state, previous) => {
  if (state.status === 'signedOut' && previous.status !== 'signedOut') {
    useWalkSpotsStore.getState().reset();
    return;
  }
  const removed = removedPetIds(previous.pets, state.pets);
  const { myCheckIns } = useWalkSpotsStore.getState();
  if ([...removed].some(id => myCheckIns[id])) {
    const kept = { ...myCheckIns };
    removed.forEach(id => delete kept[id]);
    useWalkSpotsStore.setState({ myCheckIns: kept });
    useWalkSpotsStore.getState().refreshSpots();
  }
});
